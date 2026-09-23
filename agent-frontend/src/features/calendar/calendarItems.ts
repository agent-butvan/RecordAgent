import type { DailyDaySummary } from '../../types/dailyEvent';

export interface CalendarCellItem {
  id: string;
  title: string;
  tone: 'todo' | 'schedule' | 'study' | 'record' | 'expense';
}
/** 事项优先展示真实标题，未提供标题的跨域来源保留简短汇总。 */
export function calendarCellItems(
  summary: DailyDaySummary | undefined,
  studyLabel: string | null,
  recordCount: number,
): CalendarCellItem[] {
  const items: CalendarCellItem[] = (summary?.items ?? []).map((item) => ({
    id: item.id,
    title: item.title || '无标题事项',
    tone:
      item.type === 'todo'
        ? 'todo'
        : item.type === 'schedule'
          ? 'schedule'
          : item.type === 'study'
            ? 'study'
            : item.type === 'expense'
              ? 'expense'
              : 'record',
  }));
  if (!items.length && summary?.todoCount)
    items.push({
      id: 'todos',
      title: `${summary.completedTodoCount}/${summary.todoCount} 待办`,
      tone: 'todo',
    });
  if (summary?.scheduleCount && !items.some((item) => item.tone === 'schedule'))
    items.push({
      id: 'schedules',
      title: `${summary.scheduleCount} 个日程`,
      tone: 'schedule',
    });
  if (studyLabel && !items.some((item) => item.tone === 'study'))
    items.push({ id: 'study', title: `学习 ${studyLabel}`, tone: 'study' });
  if (recordCount && !items.some((item) => item.tone === 'record'))
    items.push({
      id: 'records',
      title: `${recordCount} 篇资料`,
      tone: 'record',
    });
  if (summary?.expenseTotal && !items.some((item) => item.tone === 'expense'))
    items.push({
      id: 'expense',
      title: `支出 ¥${summary.expenseTotal.toFixed(2)}`,
      tone: 'expense',
    });
  return items;
}
