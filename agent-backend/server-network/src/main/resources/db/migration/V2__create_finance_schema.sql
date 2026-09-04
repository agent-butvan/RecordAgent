CREATE TABLE finance_account (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL,
    currency TEXT NOT NULL,
    balance_minor INTEGER NOT NULL,
    interest_enabled INTEGER NOT NULL DEFAULT 0 CHECK (interest_enabled IN (0, 1)),
    annual_rate_percent TEXT NOT NULL DEFAULT '0',
    last_accrual_date TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_finance_account_owner
    ON finance_account (owner_id, created_at);

CREATE TABLE finance_transaction (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    transaction_date TEXT NOT NULL,
    transaction_time TEXT NOT NULL,
    transaction_type TEXT NOT NULL,
    category TEXT NOT NULL,
    note TEXT NOT NULL,
    amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
    currency TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (account_id) REFERENCES finance_account(id) ON DELETE RESTRICT
);

CREATE INDEX idx_finance_transaction_owner_date
    ON finance_transaction (owner_id, transaction_date DESC, transaction_time DESC, created_at DESC);

CREATE UNIQUE INDEX idx_finance_daily_yield
    ON finance_transaction (account_id, transaction_date, transaction_type)
    WHERE transaction_type = 'yield';
