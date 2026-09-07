CREATE TABLE token_usage_turn (
    message_id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    turn_id TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cached_input_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    model_call_count INTEGER NOT NULL DEFAULT 0,
    reported_call_count INTEGER NOT NULL DEFAULT 0,
    usage_status TEXT NOT NULL,
    CHECK (input_tokens >= 0 AND output_tokens >= 0 AND cached_input_tokens BETWEEN 0 AND input_tokens),
    CHECK (total_tokens = input_tokens + output_tokens),
    CHECK (model_call_count >= 0 AND reported_call_count BETWEEN 0 AND model_call_count),
    CHECK (usage_status IN ('COMPLETE', 'PARTIAL', 'UNAVAILABLE'))
);

CREATE INDEX idx_token_usage_turn_scope
    ON token_usage_turn (owner_id, occurred_at, session_id);

CREATE TABLE token_usage_invocation (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    session_id TEXT,
    turn_id TEXT,
    message_id TEXT,
    usage_kind TEXT NOT NULL,
    purpose TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    invocation_id TEXT,
    source TEXT,
    vendor TEXT,
    model TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cached_input_tokens INTEGER,
    total_tokens INTEGER,
    duration_millis INTEGER,
    usage_status TEXT NOT NULL,
    FOREIGN KEY (message_id) REFERENCES token_usage_turn(message_id) ON DELETE CASCADE,
    CHECK (usage_kind IN ('CHAT', 'SYSTEM')),
    CHECK (input_tokens IS NULL OR input_tokens >= 0),
    CHECK (output_tokens IS NULL OR output_tokens >= 0),
    CHECK (cached_input_tokens IS NULL OR cached_input_tokens >= 0),
    CHECK (total_tokens IS NULL OR total_tokens >= 0),
    CHECK (duration_millis IS NULL OR duration_millis >= 0),
    CHECK (usage_status IN ('COMPLETE', 'PARTIAL', 'UNAVAILABLE'))
);

CREATE INDEX idx_token_usage_invocation_scope
    ON token_usage_invocation (owner_id, occurred_at, session_id);

CREATE INDEX idx_token_usage_invocation_model
    ON token_usage_invocation (owner_id, vendor, model);

CREATE INDEX idx_token_usage_invocation_purpose
    ON token_usage_invocation (owner_id, purpose);
