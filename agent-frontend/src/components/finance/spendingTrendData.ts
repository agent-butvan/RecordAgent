import type { FinanceExpenseChartDay, FinanceChartRange } from '../../types/finance';

/** 年视图按月汇总，金额与分类均累加；周、月视图保留逐日明细。 */
export function trendBuckets(days: FinanceExpenseChartDay[], range: FinanceChartRange): FinanceExpenseChartDay[] {
  if (range !== 'year') return days;
  const months = new Map<string, FinanceExpenseChartDay>();
  for (const day of days) {
    const date = `${day.date.slice(0, 7)}-01`;
    let month = months.get(date);
    if (!month) {
      month = { date, total: 0, income: 0, categories: [] };
      months.set(date, month);
    }
    month.total += day.total;
    month.income += day.income;
    for (const category of day.categories) {
      const existing = month.categories.find((item) => item.category === category.category);
      if (existing) existing.amount += category.amount;
      else month.categories.push({ ...category });
    }
  }
  return [...months.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** 使用易读的四等分刻度，并为最高点保留顶部空间。 */
export function trendCeiling(maximum: number): number {
  if (maximum <= 0) return 100;
  const rawStep = maximum * 1.1 / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].find((value) => value * magnitude >= rawStep) ?? 10;
  return step * magnitude * 4;
}

/** 根据实际宽度分布日期刻度，首尾始终保留。 */
export function trendTicks(count: number, plotWidth: number): number[] {
  if (count < 1) return [];
  if (count === 1) return [0];
  const labels = Math.min(count, Math.max(2, Math.floor(plotWidth / 64)));
  return [...new Set(Array.from({ length: labels }, (_, index) => Math.round(index * (count - 1) / (labels - 1))))];
}
