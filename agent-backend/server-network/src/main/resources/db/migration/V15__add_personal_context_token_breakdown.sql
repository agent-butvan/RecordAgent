ALTER TABLE token_usage_invocation ADD COLUMN profile_context_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE token_usage_invocation ADD COLUMN memory_recall_tokens INTEGER NOT NULL DEFAULT 0;
