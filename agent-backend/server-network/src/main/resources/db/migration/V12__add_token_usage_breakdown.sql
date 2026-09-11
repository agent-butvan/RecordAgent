ALTER TABLE token_usage_invocation ADD COLUMN model_call_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE token_usage_invocation ADD COLUMN token_counter_id TEXT;
ALTER TABLE token_usage_invocation ADD COLUMN estimated_input_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE token_usage_invocation ADD COLUMN estimation_delta_tokens INTEGER;
ALTER TABLE token_usage_invocation ADD COLUMN system_prompt_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE token_usage_invocation ADD COLUMN history_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE token_usage_invocation ADD COLUMN current_user_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE token_usage_invocation ADD COLUMN tool_schema_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE token_usage_invocation ADD COLUMN tool_result_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE token_usage_invocation ADD COLUMN rag_context_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE token_usage_invocation ADD COLUMN other_tokens INTEGER NOT NULL DEFAULT 0;

CREATE TABLE token_usage_tool (
    invocation_row_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    schema_tokens INTEGER NOT NULL DEFAULT 0,
    result_tokens INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (invocation_row_id, tool_name),
    FOREIGN KEY (invocation_row_id) REFERENCES token_usage_invocation(id) ON DELETE CASCADE,
    CHECK (schema_tokens >= 0 AND result_tokens >= 0)
);

CREATE INDEX idx_token_usage_tool_name
    ON token_usage_tool (tool_name);
