-- “记录”资料库主表：保存五类随记的通用、可检索字段。
CREATE TABLE record_entry (
    id TEXT PRIMARY KEY,                    -- 记录唯一标识（UUID）
    owner_id TEXT NOT NULL,                 -- 所属用户标识，用于隔离不同用户的数据
    record_date TEXT NOT NULL,              -- 记录归属日期，格式 YYYY-MM-DD，可与创建日期不同
    record_type TEXT NOT NULL,              -- 内容类型：quick、learning、weekly_review、reading、journal
    title TEXT,                             -- 可选标题；为空时由界面展示正文第一行摘要
    content_html TEXT NOT NULL DEFAULT '',  -- 富文本正文 HTML，用于还原编辑器内容
    content_text TEXT NOT NULL DEFAULT '',  -- 去除格式后的纯文本正文，用于搜索与摘要
    week_year INTEGER,                      -- 周复盘所属的 ISO 周年份，仅 weekly_review 类型使用
    week_number INTEGER,                    -- 周复盘所属的 ISO 自然周序号（周一开始），仅 weekly_review 使用
    pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),       -- 是否置顶：1 是，0 否
    favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),   -- 是否收藏：1 是，0 否
    archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),   -- 是否归档：1 是，0 否
    trashed_at TEXT,                        -- 移入回收站的时间；为空表示未删除
    version INTEGER NOT NULL DEFAULT 0,     -- 乐观锁版本号，避免多次编辑静默覆盖
    created_at TEXT NOT NULL,               -- 首次创建时间，使用 UTC ISO-8601 格式
    updated_at TEXT NOT NULL                -- 最近修改时间，使用 UTC ISO-8601 格式
);

-- 按用户和日期加载日历及当天记录。
CREATE INDEX idx_record_entry_owner_date
    ON record_entry (owner_id, record_date, updated_at);

-- 按类型、归档和回收站状态筛选记录。
CREATE INDEX idx_record_entry_owner_type_state
    ON record_entry (owner_id, record_type, archived, trashed_at);

-- 快速判断某个自然周是否已经撰写周复盘。
CREATE INDEX idx_record_entry_owner_week
    ON record_entry (owner_id, week_year, week_number)
    WHERE record_type = 'weekly_review' AND trashed_at IS NULL;

-- 标签表：同一用户下标签名称唯一，便于筛选和统计。
CREATE TABLE record_tag (
    id TEXT PRIMARY KEY,                    -- 标签唯一标识（UUID）
    owner_id TEXT NOT NULL,                 -- 标签所属用户标识
    name TEXT NOT NULL,                     -- 用户可见的标签名称
    created_at TEXT NOT NULL,               -- 标签首次创建时间，使用 UTC ISO-8601 格式
    UNIQUE (owner_id, name)
);

-- 记录与标签的多对多关联表。
CREATE TABLE record_entry_tag (
    record_id TEXT NOT NULL,                -- 关联的记录 ID
    tag_id TEXT NOT NULL,                   -- 关联的标签 ID
    PRIMARY KEY (record_id, tag_id),
    FOREIGN KEY (record_id) REFERENCES record_entry(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES record_tag(id) ON DELETE CASCADE
);

-- 附件元数据表：实际文件保存在数据库同级的 records/attachments 目录。
CREATE TABLE record_attachment (
    id TEXT PRIMARY KEY,                    -- 附件唯一标识（UUID）
    record_id TEXT NOT NULL,                -- 附件所属记录 ID
    original_name TEXT NOT NULL,            -- 上传时的原始文件名，用于展示和导出
    stored_name TEXT NOT NULL UNIQUE,       -- 本地保存文件名，防止同名文件相互覆盖
    media_type TEXT NOT NULL,               -- MIME 类型，用于判断图片、PDF 或普通文件
    size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0), -- 文件大小（字节）
    created_at TEXT NOT NULL,               -- 附件上传时间，使用 UTC ISO-8601 格式
    FOREIGN KEY (record_id) REFERENCES record_entry(id) ON DELETE CASCADE
);

CREATE INDEX idx_record_attachment_record
    ON record_attachment (record_id, created_at);
