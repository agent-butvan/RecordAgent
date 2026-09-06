-- 为记录补充来源引用，使日历手记与记录资料库共享同一份可追踪内容。
ALTER TABLE record_entry ADD COLUMN source TEXT NOT NULL DEFAULT 'record';
ALTER TABLE record_entry ADD COLUMN source_reference TEXT;

CREATE UNIQUE INDEX idx_record_entry_owner_source_reference
    ON record_entry (owner_id, source, source_reference)
    WHERE source_reference IS NOT NULL;

-- 旧数据库可能只有日历手记，先补齐“每日手记”系统 Tab，再建立记录投影。
INSERT OR IGNORE INTO record_tab (id, owner_id, name, system_key, sort_order, created_at)
SELECT lower(hex(randomblob(16))), owner_id, '每日手记', 'journal', 40, datetime('now')
FROM daily_event
WHERE event_type = 'journal' AND source = 'manual'
GROUP BY owner_id;

INSERT OR IGNORE INTO record_entry (
    id, owner_id, record_date, record_type, title, content_html, content_text,
    tab_id, source, source_reference, created_at, updated_at
)
SELECT 'calendar-' || e.id, e.owner_id, e.event_date, 'journal', e.title, '', j.body,
       (SELECT id FROM record_tab WHERE owner_id = e.owner_id AND system_key = 'journal'),
       'calendar', e.id, e.created_at, e.updated_at
FROM daily_event e
JOIN journal_detail j ON j.event_id = e.id
WHERE e.event_type = 'journal' AND e.source = 'manual';
