import type { DailyTokenUsage, TokenUsageOverview } from '../../types/tokenUsage';

export type UsageRange = '7d' | '30d' | '90d' | 'all';
export type TrendMetric = 'totalTokens' | 'inputTokens' | 'outputTokens' | 'modelCallCount';
export type TrendPeriod = 'day' | 'week' | 'month';

export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function createDateRange(range: UsageRange, now = new Date()): { from?: string; to?: string } {
  if (range === 'all') return {};
  const from = new Date(now);
  from.setDate(from.getDate() - ({ '7d': 6, '30d': 29, '90d': 89 }[range]));
  return { from: formatLocalDate(from), to: formatLocalDate(now) };
}

/** 补齐无调用的自然日，再按周一或自然月聚合，避免稀疏日期误导趋势。 */
export function buildTrend(overview: Pick<TokenUsageOverview, 'daily' | 'from' | 'to'>, period: TrendPeriod): DailyTokenUsage[] {
  const sorted = [...overview.daily].sort((a, b) => a.date.localeCompare(b.date));
  const start = overview.from ?? sorted[0]?.date;
  const end = overview.to ?? sorted.at(-1)?.date;
  if (!start || !end || start > end) return [];
  const values = new Map(sorted.map(day => [day.date, day]));
  const buckets = new Map<string, DailyTokenUsage>();
  for (const cursor = new Date(`${start}T12:00:00`); formatLocalDate(cursor) <= end; cursor.setDate(cursor.getDate() + 1)) {
    const date = formatLocalDate(cursor);
    const bucketDate = new Date(cursor);
    if (period === 'week') bucketDate.setDate(bucketDate.getDate() - (bucketDate.getDay() + 6) % 7);
    if (period === 'month') bucketDate.setDate(1);
    const key = formatLocalDate(bucketDate);
    const bucket = buckets.get(key) ?? { date: key, inputTokens: 0, outputTokens: 0, totalTokens: 0, modelCallCount: 0 };
    const day = values.get(date);
    if (day) {
      bucket.inputTokens += day.inputTokens;
      bucket.outputTokens += day.outputTokens;
      bucket.totalTokens += day.totalTokens;
      bucket.modelCallCount += day.modelCallCount;
    }
    buckets.set(key, bucket);
  }
  return [...buckets.values()];
}

export function percentage(value: number, total: number): string {
  return total > 0 ? `${(value / total * 100).toFixed(1)}%` : '—';
}

export function groupVendors(models: TokenUsageOverview['byModel']) {
  const vendors = new Map<string, { vendor: string; totalTokens: number; modelCallCount: number; models: number }>();
  for (const model of models) {
    const key = model.vendor || '未知供应商';
    const row = vendors.get(key) ?? { vendor: key, totalTokens: 0, modelCallCount: 0, models: 0 };
    row.totalTokens += model.totalTokens;
    row.modelCallCount += model.modelCallCount;
    row.models += 1;
    vendors.set(key, row);
  }
  return [...vendors.values()];
}
