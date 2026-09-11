import assert from 'node:assert/strict';
import test from 'node:test';
import { overviewTodos, overviewRecords, overviewDuration } from './overviewData.ts';

test('待办排除其他记录，按未完成、优先级和时间排序且保留循环条目的版本', () => {
  const todo = (id, completed, priority, time) => ({ id, eventType: 'todo', version: 4, details: { completed, priority, time, recurrence: 'daily' } });
  const day = { date: '2026-09-10', events: [
    todo('done', true, 'high', '08:00'), todo('late', false, 'high', '12:00'),
    { id: 'expense', eventType: 'expense' }, todo('normal', false, 'medium', '07:00'),
    todo('no-time', false, 'high', null), todo('early', false, 'high', '09:00'),
  ] };
  const before = structuredClone(day);
  const result = overviewTodos(day);
  assert.deepEqual(result.map((item) => item.id), ['early', 'late', 'no-time', 'normal', 'done']);
  assert.equal(result[0].version, 4);
  assert.equal(result[0].details.recurrence, 'daily');
  assert.deepEqual(day, before);
  assert.deepEqual(overviewTodos({ events: [] }), []);
});

test('资料按归属日期统计今天，排除归档和回收站，最近整理只取最新三条', () => {
  const records = [
    { id: 'old', recordDate: '2026-09-09', updatedAt: '2026-09-10T10:00:00Z' },
    { id: 'today', recordDate: '2026-09-10', updatedAt: '2026-09-10T09:00:00Z' },
    { id: 'archived', recordDate: '2026-09-10', updatedAt: '2026-09-10T12:00:00Z', archived: true },
    { id: 'trash', recordDate: '2026-09-10', updatedAt: '2026-09-10T13:00:00Z', trashedAt: '2026-09-10T13:00:00Z' },
    { id: 'third', recordDate: '2026-09-10', updatedAt: '2026-09-10T08:00:00Z' },
    { id: 'fourth', recordDate: '2026-09-08', updatedAt: '2026-09-08T08:00:00Z' },
  ];
  const before = structuredClone(records);
  assert.deepEqual(overviewRecords(records, '2026-09-10'), { todayCount: 2, recent: [records[0], records[1], records[4]] });
  assert.deepEqual(records, before);
  assert.deepEqual(overviewRecords([], '2026-09-10'), { todayCount: 0, recent: [] });
});

test('学习时长不会将正在开始的学习或零值误显示成一小时', () => {
  assert.equal(overviewDuration(0), '0 分钟');
  assert.equal(overviewDuration(59), '不足 1 分钟');
  assert.equal(overviewDuration(60), '1 分钟');
  assert.equal(overviewDuration(3660), '1 小时 1 分钟');
});
