CREATE TABLE daily_event (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    event_date TEXT NOT NULL,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    original_content TEXT,
    source TEXT NOT NULL,
    source_reference TEXT,
    status TEXT NOT NULL,
    extension_json TEXT NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_daily_event_owner_date
    ON daily_event (owner_id, event_date, created_at);

CREATE INDEX idx_daily_event_owner_type_date
    ON daily_event (owner_id, event_type, event_date);

CREATE TABLE todo_detail (
    event_id TEXT PRIMARY KEY,
    todo_time TEXT,
    priority TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
    completed_at TEXT,
    FOREIGN KEY (event_id) REFERENCES daily_event(id) ON DELETE CASCADE
);

CREATE TABLE schedule_detail (
    event_id TEXT PRIMARY KEY,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    location TEXT,
    timezone TEXT NOT NULL,
    recurrence_rule TEXT,
    FOREIGN KEY (event_id) REFERENCES daily_event(id) ON DELETE CASCADE
);

CREATE TABLE expense_detail (
    event_id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    note TEXT NOT NULL,
    amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
    expense_time TEXT NOT NULL,
    currency TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES daily_event(id) ON DELETE CASCADE
);

CREATE TABLE journal_detail (
    event_id TEXT PRIMARY KEY,
    body TEXT NOT NULL,
    mood TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES daily_event(id) ON DELETE CASCADE
);
