import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarCellItems } from './calendarItems.ts';
test('优先保留真实标题并按类型配色，汇总不重复同类事项', () => {
  const items = calendarCellItems({ items: [{ id: 'a', type: 'todo', title: '完成复盘' }, { id: 'b', type: 'study', title: '阅读设计文档' }], todoCount: 1, completedTodoCount: 0, expenseTotal: 12 }, '30分钟', 1);
  assert.deepEqual(items.map(item => item.title), ['完成复盘', '阅读设计文档', '1 篇资料', '支出 ¥12.00']);
  assert.deepEqual(items.map(item => item.tone), ['todo', 'study', 'record', 'expense']);
});
test('兼容旧版摘要与无记录日期', () => {
  assert.deepEqual(calendarCellItems(undefined, null, 0), []);
  assert.equal(calendarCellItems({ todoCount: 2, completedTodoCount: 1 }, null, 0)[0].title, '1/2 待办');
});
