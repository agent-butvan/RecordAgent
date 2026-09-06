-- 记录分类 Tab：系统分类与用户自定义分类使用同一张表持久化。
CREATE TABLE record_tab (
    id TEXT PRIMARY KEY,                    -- Tab 唯一标识（UUID）
    owner_id TEXT NOT NULL,                 -- Tab 所属用户标识
    name TEXT NOT NULL,                     -- Tab 的用户可见名称
    system_key TEXT,                        -- 系统 Tab 固定键；自定义 Tab 为空
    sort_order INTEGER NOT NULL DEFAULT 0,  -- Tab 在首页的显示顺序，数值越小越靠前
    created_at TEXT NOT NULL,               -- Tab 创建时间，使用 UTC ISO-8601 格式
    UNIQUE (owner_id, name),
    UNIQUE (owner_id, system_key)
);

-- 每条记录归属于一个具体 Tab；旧数据迁移期间允许为空，由领域 Service 自动补齐。
ALTER TABLE record_entry ADD COLUMN tab_id TEXT REFERENCES record_tab(id) ON DELETE SET NULL;

CREATE INDEX idx_record_tab_owner_order
    ON record_tab (owner_id, sort_order, created_at);

CREATE INDEX idx_record_entry_owner_tab
    ON record_entry (owner_id, tab_id, record_date);

-- 为已有用户建立系统 Tab，确保升级后旧记录立即可见。
INSERT INTO record_tab (id, owner_id, name, system_key, sort_order, created_at)
SELECT lower(hex(randomblob(16))), owner_id, '八股文', 'knowledge', 10, datetime('now') FROM record_entry GROUP BY owner_id;
INSERT INTO record_tab (id, owner_id, name, system_key, sort_order, created_at)
SELECT lower(hex(randomblob(16))), owner_id, '面试题', 'interview', 20, datetime('now') FROM record_entry GROUP BY owner_id;
INSERT INTO record_tab (id, owner_id, name, system_key, sort_order, created_at)
SELECT lower(hex(randomblob(16))), owner_id, '每周复盘', 'weekly_review', 30, datetime('now') FROM record_entry GROUP BY owner_id;
INSERT INTO record_tab (id, owner_id, name, system_key, sort_order, created_at)
SELECT lower(hex(randomblob(16))), owner_id, '每日手记', 'journal', 40, datetime('now') FROM record_entry GROUP BY owner_id;
INSERT INTO record_tab (id, owner_id, name, system_key, sort_order, created_at)
SELECT lower(hex(randomblob(16))), owner_id, '读书心得', 'reading', 50, datetime('now') FROM record_entry GROUP BY owner_id;
INSERT INTO record_tab (id, owner_id, name, system_key, sort_order, created_at)
SELECT lower(hex(randomblob(16))), owner_id, '随记', 'quick', 60, datetime('now') FROM record_entry GROUP BY owner_id;

-- 旧记录按原有类型与标签归入最接近的系统 Tab。
UPDATE record_entry SET tab_id = (SELECT id FROM record_tab WHERE owner_id = record_entry.owner_id AND system_key = 'weekly_review') WHERE record_type = 'weekly_review';
UPDATE record_entry SET tab_id = (SELECT id FROM record_tab WHERE owner_id = record_entry.owner_id AND system_key = 'journal') WHERE record_type = 'journal';
UPDATE record_entry SET tab_id = (SELECT id FROM record_tab WHERE owner_id = record_entry.owner_id AND system_key = 'reading') WHERE record_type = 'reading';
UPDATE record_entry SET tab_id = (SELECT id FROM record_tab WHERE owner_id = record_entry.owner_id AND system_key = 'quick') WHERE record_type = 'quick';
UPDATE record_entry SET tab_id = (SELECT id FROM record_tab WHERE owner_id = record_entry.owner_id AND system_key = 'interview')
WHERE record_type = 'learning' AND (title LIKE '%面试题%' OR content_text LIKE '%面试题%' OR EXISTS (
    SELECT 1 FROM record_entry_tag et JOIN record_tag t ON t.id = et.tag_id WHERE et.record_id = record_entry.id AND t.name = '面试题'));
UPDATE record_entry SET tab_id = (SELECT id FROM record_tab WHERE owner_id = record_entry.owner_id AND system_key = 'knowledge')
WHERE record_type = 'learning' AND tab_id IS NULL;
