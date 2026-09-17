-- 每日手记以日记录投影同步到日历；记录资料库仍是这类投影的唯一写入来源。
INSERT OR IGNORE INTO daily_event (
    id, owner_id, event_date, event_type, title, source, source_reference,
    status, extension_json, version, created_at, updated_at
)
SELECT 'record-' || id, owner_id, record_date, 'journal',
       COALESCE(NULLIF(TRIM(title), ''), '无标题记录'), 'record', id,
       'confirmed', '{}', 0, created_at, updated_at
FROM record_entry
WHERE record_type = 'journal' AND trashed_at IS NULL;

INSERT OR IGNORE INTO journal_detail (event_id, body, mood)
SELECT 'record-' || id, content_text, '来自记录'
FROM record_entry
WHERE record_type = 'journal' AND trashed_at IS NULL;

CREATE UNIQUE INDEX idx_daily_event_owner_source_reference
    ON daily_event (owner_id, source, source_reference)
    WHERE source_reference IS NOT NULL;
