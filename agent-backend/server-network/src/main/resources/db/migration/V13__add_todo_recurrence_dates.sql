ALTER TABLE todo_detail
    ADD COLUMN recurrence_weekday INTEGER
        CHECK (recurrence_weekday BETWEEN 1 AND 7);

ALTER TABLE todo_detail
    ADD COLUMN recurrence_month_day INTEGER
        CHECK (recurrence_month_day BETWEEN 1 AND 31);

-- 既有周期待办沿用原先固定在周一或每月 1 号的行为。
UPDATE todo_detail SET recurrence_weekday = 1 WHERE recurrence = 'weekly';
UPDATE todo_detail SET recurrence_month_day = 1 WHERE recurrence = 'monthly';
