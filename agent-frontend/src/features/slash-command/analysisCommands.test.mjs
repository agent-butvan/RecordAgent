import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareAnalysisCommand } from './analysisCommands.ts';

const NOW = new Date(2026, 8, 11, 13);

test('日复盘明确展示四类数据并要求逐次隐私确认', () => {
  const prepared = prepareAnalysisCommand('daily-review', '', NOW, 'Asia/Shanghai');
  assert.equal(prepared.scopeLabel, '2026-09-11');
  assert.equal(prepared.privacyRequired, true);
  assert.match(prepared.displayPrompt, /日历、资料、财务、学习/);
  assert.equal(prepared.request.privacyConfirmed, false);
});

test('周复盘按锚点日期展示完整自然周', () => {
  const prepared = prepareAnalysisCommand('weekly-review', '2026-09-11', NOW, 'Asia/Shanghai');
  assert.equal(prepared.scopeLabel, '2026-09-07 至 2026-09-13');
});

test('分析范围拒绝未声明值', () => {
  assert.throws(() => prepareAnalysisCommand('todo-review', 'month', NOW), /仅支持 today 或 week/);
  assert.throws(() => prepareAnalysisCommand('finance-review', 'today', NOW), /仅支持 week 或 month/);
});

test('学习计划保留目标并只声明近期学习数据', () => {
  const prepared = prepareAnalysisCommand('study-plan', '完成数据库课程', NOW, 'Asia/Shanghai');
  assert.match(prepared.displayPrompt, /完成数据库课程/);
  assert.equal(prepared.privacyRequired, false);
  assert.equal(prepared.request.argument, '完成数据库课程');
});
