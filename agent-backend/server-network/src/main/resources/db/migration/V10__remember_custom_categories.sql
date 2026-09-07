CREATE TABLE study_category (
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, name)
);

INSERT OR IGNORE INTO study_category (owner_id, name, created_at)
SELECT e.owner_id, s.category, MIN(e.created_at)
FROM study_session_detail s
JOIN daily_event e ON e.id = s.event_id
WHERE trim(s.category) <> ''
GROUP BY e.owner_id, s.category;

CREATE TABLE finance_transaction_category (
    owner_id TEXT NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('expense', 'income')),
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, transaction_type, name)
);

INSERT OR IGNORE INTO finance_transaction_category (owner_id, transaction_type, name, created_at)
SELECT owner_id, transaction_type, category, MIN(created_at)
FROM finance_transaction
WHERE transaction_type IN ('expense', 'income') AND trim(category) <> ''
GROUP BY owner_id, transaction_type, category;
