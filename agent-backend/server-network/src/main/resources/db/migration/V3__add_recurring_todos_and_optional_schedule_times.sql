ALTER TABLE todo_detail
    ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'none'
        CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly'));

CREATE TABLE todo_completion (
    event_id TEXT NOT NULL,
    period_start TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    PRIMARY KEY (event_id, period_start),
    FOREIGN KEY (event_id) REFERENCES daily_event(id) ON DELETE CASCADE
);

INSERT INTO todo_completion (event_id, period_start, completed_at)
SELECT t.event_id, e.event_date, COALESCE(t.completed_at, e.updated_at)
FROM todo_detail t
JOIN daily_event e ON e.id = t.event_id
WHERE t.completed = 1;

CREATE TABLE schedule_detail_new (
    event_id TEXT PRIMARY KEY,
    start_time TEXT,
    end_time TEXT,
    location TEXT,
    timezone TEXT NOT NULL,
    recurrence_rule TEXT,
    FOREIGN KEY (event_id) REFERENCES daily_event(id) ON DELETE CASCADE
);

INSERT INTO schedule_detail_new (event_id, start_time, end_time, location, timezone, recurrence_rule)
SELECT event_id, start_time, end_time, location, timezone, recurrence_rule
FROM schedule_detail;

DROP TABLE schedule_detail;
ALTER TABLE schedule_detail_new RENAME TO schedule_detail;
