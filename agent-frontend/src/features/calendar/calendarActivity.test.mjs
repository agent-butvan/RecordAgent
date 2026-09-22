import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarActivity } from './calendarActivity.ts';
const base = { studySeconds: 0, completedTodos: 0, records: 0, available: true, future: false };
test('未加载或失败与已知无活动区分；未来不染色', () => {
  assert.equal(calendarActivity({ ...base, available: false }), null);
  assert.deepEqual(calendarActivity(base), { score: 0, level: 0 });
  assert.deepEqual(calendarActivity({ ...base, future: true, records: 3 }), { score: 0, level: 0 });
});
test('学习按半小时累计，各来源独立封顶', () => {
  assert.equal(calendarActivity({ ...base, studySeconds: 1799 }).score, 0);
  assert.equal(calendarActivity({ ...base, studySeconds: 1800 }).score, 10);
  assert.deepEqual(calendarActivity({ ...base, studySeconds: 86400, completedTodos: 100, records: 100 }), { score: 100, level: 4 });
});
test('固定分段和负值保护，不读取收入支出等无关字段', () => {
  for (const [score, level] of [[10, 1], [30, 2], [50, 2], [60, 3], [80, 4]]) {
    const studySeconds = Math.min(score, 40) / 10 * 1800;
    const completedTodos = Math.min(Math.max(score - 40, 0), 30) / 10;
    const records = Math.max(score - 70, 0) / 10;
    assert.equal(calendarActivity({ ...base, studySeconds, completedTodos, records }).level, level);
  }
  assert.equal(calendarActivity({ ...base, studySeconds: -1, records: -5, completedTodos: -3 }).score, 0);
  assert.equal(calendarActivity({ ...base, income: 9999, expense: 9999 }).score, 0);
});
