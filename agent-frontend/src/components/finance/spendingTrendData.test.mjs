import assert from 'node:assert/strict';
import test from 'node:test';
import { trendBuckets, trendCeiling, trendTicks } from './spendingTrendData.ts';

test('年视图合并月份、收支和同名分类，不修改原始日数据', () => {
  const days = [
    { date: '2026-02-01', total: 30, income: 200, categories: [{ category: '交通', amount: 30 }] },
    { date: '2026-01-01', total: 10, income: 100, categories: [{ category: '餐饮', amount: 10 }] },
    { date: '2026-01-02', total: 25, income: 50, categories: [{ category: '餐饮', amount: 20 }, { category: '交通', amount: 5 }] },
  ];
  const original = structuredClone(days);
  const months = trendBuckets(days, 'year');
  assert.deepEqual(months, [
    { date: '2026-01-01', total: 35, income: 150, categories: [{ category: '餐饮', amount: 30 }, { category: '交通', amount: 5 }] },
    { date: '2026-02-01', total: 30, income: 200, categories: [{ category: '交通', amount: 30 }] },
  ]);
  assert.deepEqual(days, original);
  assert.equal(trendBuckets(days, 'month'), days);
  assert.equal(trendBuckets(days, 'week'), days);
  assert.deepEqual(trendBuckets([], 'year'), []);
});

test('刻度覆盖零值、小数和大额，并留出顶部空间', () => {
  assert.equal(trendCeiling(0), 100);
  for (const maximum of [.01, .99, 1, 23, 100, 10001, 9e8]) {
    const ceiling = trendCeiling(maximum);
    assert.ok(Number.isFinite(ceiling));
    assert.ok(ceiling >= maximum * 1.1);
  }
});

test('日期刻度兼容空集、单点、窄屏和全年视图，首尾不遗漏', () => {
  assert.deepEqual(trendTicks(0, 300), []);
  assert.deepEqual(trendTicks(1, 300), [0]);
  for (const count of [2, 7, 12, 31, 366]) {
    for (const width of [1, 160, 320, 1000]) {
      const ticks = trendTicks(count, width);
      assert.equal(ticks[0], 0);
      assert.equal(ticks.at(-1), count - 1);
      assert.equal(new Set(ticks).size, ticks.length);
      assert.ok(ticks.every((tick) => Number.isInteger(tick) && tick >= 0 && tick < count));
      assert.ok(ticks.length <= Math.max(2, Math.floor(width / 64)));
    }
  }
});
