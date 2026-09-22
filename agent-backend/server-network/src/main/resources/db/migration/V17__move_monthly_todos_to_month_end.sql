-- 每月待办统一在自然月最后一天发生；31 作为持久化规则标识，实际日期按月份计算。
UPDATE todo_detail
SET recurrence_month_day = 31
WHERE recurrence = 'monthly';
