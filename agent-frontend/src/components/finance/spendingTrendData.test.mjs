import assert from 'node:assert/strict';
import test from 'node:test';
import { trendBuckets, trendCeiling, trendTicks, hasOutlier, createTrendScale } from './spendingTrendData.ts';

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

test('准确识别大额极值，并在平缓数据时不误报', () => {
  // 极端值场景：大部分日期 10~50 元，某一天 3900 元
  assert.equal(hasOutlier([10, 0, 15, 20, 50, 10, 3900, 5]), true);
  // 平缓数据场景：各日相近
  assert.equal(hasOutlier([100, 150, 120, 200, 180, 220]), false);
  // 全为极小额
  assert.equal(hasOutlier([5, 8, 3, 10, 15]), false);
  // 单笔数据
  assert.equal(hasOutlier([3000]), false);
});

test('增强比例尺保证大额置顶、小额显著可见且刻度合理', () => {
  const ceiling = 4800;
  const enhanced = createTrendScale(ceiling, true);
  assert.equal(enhanced.isEnhanced, true);
  // 0 元对应 0
  assert.equal(enhanced.map(0), 0);
  // 顶部对应 1
  assert.equal(enhanced.map(ceiling), 1);
  // 50 元小额：原线性只有 50/4800 ≈ 0.0104 (1%)，平方根增强后约为 0.102 (10.2%)，高度显著放大
  const ratio50 = enhanced.map(50);
  assert.ok(ratio50 > 0.09 && ratio50 < 0.12);
  // 刻度线 5 条
  assert.equal(enhanced.ticks.length, 5);
  assert.equal(enhanced.ticks[0].value, 0);
  assert.equal(enhanced.ticks[4].value, ceiling);

  // 普通线性比例尺
  const linear = createTrendScale(ceiling, false);
  assert.equal(linear.isEnhanced, false);
  assert.equal(linear.map(50), 50 / ceiling);
});
