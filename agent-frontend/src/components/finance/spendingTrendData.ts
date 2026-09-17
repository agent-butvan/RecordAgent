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
  const rawStep = (maximum * 1.1) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  // 提供更密集的步长候选，避免小幅超越时上限翻倍过大
  const candidateSteps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const step = candidateSteps.find((value) => value * magnitude >= rawStep) ?? 10;
  return step * magnitude * 4;
}

/** 根据实际宽度分布日期刻度，首尾始终保留。 */
export function trendTicks(count: number, plotWidth: number): number[] {
  if (count < 1) return [];
  if (count === 1) return [0];
  const labels = Math.min(count, Math.max(2, Math.floor(plotWidth / 64)));
  return [...new Set(Array.from({ length: labels }, (_, index) => Math.round(index * (count - 1) / (labels - 1))))];
}

/** 检测收支数据中是否存在某日极大数值（极值），导致日常小额被压制贴地。 */
export function hasOutlier(values: number[]): boolean {
  const nonZero = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (nonZero.length < 2) return false;
  const max = nonZero[nonZero.length - 1];
  if (max < 200) return false;
  const p75 = nonZero[Math.floor((nonZero.length - 1) * 0.75)];
  const baseline = Math.max(20, p75);
  return max / baseline >= 3.5;
}

export interface TrendScaleTick {
  value: number;
  ratio: number;
}

export interface TrendScale {
  isEnhanced: boolean;
  map: (amount: number) => number;
  ticks: TrendScaleTick[];
}

/** 构建趋势图比例尺，支持自适应平方根平滑增强，使小额起伏清晰可辨。 */
export function createTrendScale(ceiling: number, enhanced: boolean): TrendScale {
  const safeCeiling = ceiling > 0 ? ceiling : 100;
  if (!enhanced) {
    return {
      isEnhanced: false,
      map: (amount: number) => Math.max(0, Math.min(1, amount / safeCeiling)),
      ticks: [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
        value: safeCeiling * ratio,
        ratio,
      })),
    };
  }

  return {
    isEnhanced: true,
    map: (amount: number) => (amount <= 0 ? 0 : Math.max(0, Math.min(1, Math.sqrt(amount / safeCeiling)))),
    ticks: [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      value: Math.round(ratio * ratio * safeCeiling),
      ratio,
    })),
  };
}
