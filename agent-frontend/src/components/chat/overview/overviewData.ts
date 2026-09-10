import type { DailyDay, TodoDailyEvent } from '../../../types/dailyEvent';
import type { RecordEntry } from '../../../types/record';

/** 未完成优先，其次重要程度与时间；保留服务端事件及版本，不改动输入。 */
export function overviewTodos(day: DailyDay): TodoDailyEvent[] {
  const priority = { high: 0, medium: 1, low: 2 };
  return day.events.filter((event): event is TodoDailyEvent => event.eventType === 'todo')
    .sort((a, b) => Number(a.details.completed) - Number(b.details.completed)
      || priority[a.details.priority] - priority[b.details.priority]
      || (a.details.time || '24:00').localeCompare(b.details.time || '24:00'));
}

/** 资料概览按资料归属日期统计，排除归档和回收站内容。 */
export function overviewRecords(records: RecordEntry[], today: string) {
  const visible = records.filter((entry) => !entry.archived && !entry.trashedAt);
  return {
    todayCount: visible.filter((entry) => entry.recordDate === today).length,
    recent: [...visible].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3),
  };
}

export function overviewDuration(seconds: number): string {
  if (seconds > 0 && seconds < 60) return '不足 1 分钟';
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟` : `${minutes} 分钟`;
}
