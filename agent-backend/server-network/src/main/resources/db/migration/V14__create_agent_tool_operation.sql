CREATE TABLE agent_tool_operation (
    owner_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    result_json TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, tool_name, idempotency_key)
);

CREATE INDEX idx_agent_tool_operation_created_at
    ON agent_tool_operation (created_at);
