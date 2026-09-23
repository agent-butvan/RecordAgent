-- 自动任务与执行事实独立于 Agent 子任务；版本预留 V17 给日历分支。
CREATE TABLE automation_task (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL,
 rule_title TEXT NOT NULL,
 rule_content TEXT NOT NULL,
 rule_kind TEXT NOT NULL,
 rule_trigger TEXT NOT NULL,
 rule_timezone TEXT NOT NULL,
 rule_at_time TEXT NOT NULL,
 rule_once_at TEXT,
 rule_weekdays INTEGER NOT NULL,
 rule_minutes INTEGER NOT NULL,
 rule_break_minutes INTEGER NOT NULL,
 rule_window_start TEXT NOT NULL,
 rule_window_end TEXT NOT NULL,
 rule_desktop INTEGER NOT NULL,
 rule_email INTEGER NOT NULL,
 rule_confirm INTEGER NOT NULL,
 rule_sound INTEGER NOT NULL,
 rule_expense INTEGER NOT NULL,
 rule_todo INTEGER NOT NULL,
 rule_study INTEGER NOT NULL,
 status TEXT NOT NULL, version INTEGER NOT NULL, next_at INTEGER,
 active_seconds INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL
);
CREATE INDEX idx_automation_owner ON automation_task(owner_id, status);
CREATE TABLE automation_run (
 id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES automation_task(id), owner_id TEXT NOT NULL,
 title TEXT NOT NULL, content TEXT NOT NULL, planned_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
 source TEXT NOT NULL, status TEXT NOT NULL, desktop_status TEXT NOT NULL, email_status TEXT NOT NULL,
 recipient TEXT, confirmation TEXT NOT NULL, sound INTEGER NOT NULL, error TEXT NOT NULL DEFAULT '',
 UNIQUE(task_id, source, planned_at)
);
CREATE INDEX idx_automation_run_task ON automation_run(owner_id, task_id, created_at);
CREATE INDEX idx_automation_run_delivery ON automation_run(email_status, desktop_status, confirmation);
