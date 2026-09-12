export type SlashQueryPeriod = 'today' | 'week' | 'month';

/** 解析可选自然日；空值和 today 都表示调用方本地今天。 */
export function parseOptionalDateArgument(input: string, now = new Date()): string {
  const normalized = input.trim().toLowerCase();
  if (!normalized || normalized === 'today') return formatDate(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error('日期格式应为 YYYY-MM-DD，或使用 today。');
  }
  const [year, month, day] = normalized.split('-').map(Number);
  const parsed = new Date(year, month - 1, day, 12);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    throw new Error('请输入有效的自然日。');
  }
  return normalized;
}

/** 解析确定性查询的时间范围，并拒绝会被静默忽略的多余参数。 */
export function parseQueryPeriod(input: string, fallback: SlashQueryPeriod): SlashQueryPeriod {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === 'today' || normalized === 'week' || normalized === 'month') return normalized;
  throw new Error('时间范围仅支持 today、week 或 month。');
}

/** 以本地自然日计算查询闭区间，周从周一开始。 */
export function queryPeriodRange(period: SlashQueryPeriod, now = new Date()): { from: string; to: string } {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const start = new Date(end);
  if (period === 'week') {
    const weekday = start.getDay() || 7;
    start.setDate(start.getDate() - weekday + 1);
  } else if (period === 'month') {
    start.setDate(1);
  }
  return { from: formatDate(start), to: formatDate(end) };
}

function formatDate(date: Date): string {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((value, index) => index === 0 ? String(value) : String(value).padStart(2, '0'))
    .join('-');
}
