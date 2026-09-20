-- 通用文件资产：业务只保存稳定 file_id，实际内容由存储适配器管理。
CREATE TABLE file_asset (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    original_name TEXT NOT NULL,
    media_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
    sha256 TEXT,
    backend_type TEXT NOT NULL,
    storage_profile_id TEXT,
    storage_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE INDEX idx_file_asset_owner_state
    ON file_asset (owner_id, status, created_at);

-- 文件与业务对象的通用关联。domain_type、role 使用后端受控枚举值写入。
CREATE TABLE file_binding (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    domain_type TEXT NOT NULL,
    domain_id TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (file_id) REFERENCES file_asset(id) ON DELETE CASCADE,
    UNIQUE (file_id, domain_type, domain_id, role)
);

CREATE INDEX idx_file_binding_domain
    ON file_binding (owner_id, domain_type, domain_id, role, created_at);

-- 将既有资料附件登记为通用文件资产。原文件保持原位，由本地适配器兼容读取。
INSERT INTO file_asset (
    id, owner_id, original_name, media_type, size_bytes, sha256, backend_type,
    storage_profile_id, storage_key, status, created_at, updated_at, deleted_at
)
SELECT a.id, r.owner_id, a.original_name, a.media_type, a.size_bytes, NULL, 'LOCAL',
       NULL, 'records/attachments/' || a.stored_name, 'AVAILABLE', a.created_at, a.created_at, NULL
FROM record_attachment a
JOIN record_entry r ON r.id = a.record_id;

INSERT INTO file_binding (id, file_id, owner_id, domain_type, domain_id, role, created_at)
SELECT 'record-attachment-' || a.id, a.id, r.owner_id, 'RECORD', a.record_id, 'ATTACHMENT', a.created_at
FROM record_attachment a
JOIN record_entry r ON r.id = a.record_id;

-- 元数据已经迁移到通用模型；物理文件继续由 legacy storage_key 兼容读取。
DROP TABLE record_attachment;
