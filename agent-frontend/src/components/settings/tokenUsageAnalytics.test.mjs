import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTrend, createDateRange, groupVendors, percentage } from './tokenUsageAnalytics.ts';

const day = (date, tokens) => ({ date, inputTokens: tokens - 2, outputTokens: 2, totalTokens: tokens, modelCallCount: 1 });

test('近 7/30/90 天包含首尾日期，正确跨越闰年二月', () => {
  const now = new Date(2024, 2, 1, 12);
  assert.deepEqual(createDateRange('7d', now), { from: '2024-02-24', to: '2024-03-01' });
  assert.deepEqual(createDateRange('30d', now), { from: '2024-02-01', to: '2024-03-01' });
  assert.deepEqual(createDateRange('90d', now), { from: '2023-12-03', to: '2024-03-01' });
  assert.deepEqual(createDateRange('all', now), {});
});

test('日趋势补齐空白日期、过滤范围外记录，并保留原始数据', () => {
  const overview = { from: '2026-09-01', to: '2026-09-03', daily: [day('2026-09-03', 20), day('2026-08-31', 90), day('2026-09-01', 10)] };
  const original = structuredClone(overview);
  assert.deepEqual(buildTrend(overview, 'day'), [day('2026-09-01', 10), { date: '2026-09-02', inputTokens: 0, outputTokens: 0, totalTokens: 0, modelCallCount: 0 }, day('2026-09-03', 20)]);
  assert.deepEqual(overview, original);
});

test('按周一聚合，跨年及部分周期不混入范围外用量', () => {
  const points = buildTrend({ from: '2025-12-31', to: '2026-01-05', daily: [day('2025-12-30', 100), day('2025-12-31', 10), day('2026-01-04', 20), day('2026-01-05', 40)] }, 'week');
  assert.deepEqual(points, [
    { date: '2025-12-29', inputTokens: 26, outputTokens: 4, totalTokens: 30, modelCallCount: 2 },
    day('2026-01-05', 40),
  ]);
});

test('全部时间的月趋势保留无调用月份', () => {
  const points = buildTrend({ from: null, to: null, daily: [day('2026-03-03', 30), day('2026-01-31', 10)] }, 'month');
  assert.deepEqual(points.map(point => [point.date, point.totalTokens]), [['2026-01-01', 10], ['2026-02-01', 0], ['2026-03-01', 30]]);
});

test('空数据和零分母不产生虚构用量或 NaN', () => {
  assert.deepEqual(buildTrend({ from: null, to: null, daily: [] }, 'day'), []);
  assert.equal(buildTrend({ from: '2026-01-01', to: '2026-01-07', daily: [] }, 'day').length, 7);
  assert.equal(percentage(0, 0), '—');
  assert.equal(percentage(1, 4), '25.0%');
  assert.equal(percentage(0, 4), '0.0%');
});

test('供应商聚合保留调用与 Token 总量，独立处理未知供应商', () => {
  assert.deepEqual(groupVendors([
    { vendor: 'A', totalTokens: 10, modelCallCount: 2 },
    { vendor: 'A', totalTokens: 20, modelCallCount: 3 },
    { vendor: '', totalTokens: 4, modelCallCount: 1 },
  ]), [
    { vendor: 'A', totalTokens: 30, modelCallCount: 5, models: 2 },
    { vendor: '未知供应商', totalTokens: 4, modelCallCount: 1, models: 1 },
  ]);
});
