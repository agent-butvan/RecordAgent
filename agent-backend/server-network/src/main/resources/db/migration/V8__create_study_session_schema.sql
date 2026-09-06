CREATE TABLE study_session_detail (
    event_id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    category TEXT NOT NULL,
    timezone TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES daily_event(id) ON DELETE CASCADE,
    CHECK (ended_at IS NULL OR ended_at > started_at)
);

CREATE INDEX idx_study_session_started_at
    ON study_session_detail (started_at);

CREATE INDEX idx_study_session_ended_at
    ON study_session_detail (ended_at);

CREATE UNIQUE INDEX idx_study_one_active_per_owner
    ON daily_event (owner_id)
    WHERE event_type = 'study' AND status = 'active';
