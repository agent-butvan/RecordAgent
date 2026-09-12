import type { CalendarDayEntry } from '../../types/calendar';
import type { DailyDay } from '../../types/dailyEvent';

const TODO_RECURRENCE_ORDER = { none: 0, daily: 1, weekly: 2, monthly: 3 } as const;

/** 将可扩展日记录联合类型适配为当前日历页面的展示模型。 */
export function toCalendarDayEntry(day: DailyDay): CalendarDayEntry {
  const entry: CalendarDayEntry = { todos: [], schedules: [], expenses: [], incomes: [], journals: [], photos: [], otherRecords: [] };
  for (const event of day.events) {
    if (event.eventType === 'todo') {
      entry.todos.push({
        id: event.id,
        title: event.title,
        time: event.details.time ?? undefined,
        priority: event.details.priority,
        completed: event.details.completed,
        recurrence: event.details.recurrence,
        recurrenceWeekday: event.details.recurrenceWeekday ?? undefined,
        recurrenceMonthDay: event.details.recurrenceMonthDay ?? undefined,
        version: event.version,
      });
    } else if (event.eventType === 'schedule') {
      entry.schedules.push({
        id: event.id,
        version: event.version,
        title: event.title,
        startTime: event.details.startTime ?? undefined,
        endTime: event.details.endTime ?? undefined,
        location: event.details.location ?? undefined,
        color: 'blue',
      });
    } else if (event.eventType === 'expense') {
      entry.expenses.push({
        id: event.id,
        version: event.version,
        source: event.source,
        category: event.details.category,
        note: event.details.note,
        amount: event.details.amount,
        time: event.details.time,
        color: 'orange',
      });
    } else if (event.eventType === 'income') {
      entry.incomes.push({
        id: event.id,
        source: event.source,
        category: event.details.category,
        note: event.details.note,
        amount: event.details.amount,
        time: event.details.time,
      });
    } else if (event.eventType === 'journal') {
      const journal = {
        id: event.id,
        version: event.version,
        source: event.source,
        title: event.title === '无标题记录' || event.title === '无标题手记' ? undefined : event.title,
        excerpt: event.details.body,
        mood: event.details.mood,
        updatedAt: event.updatedAt,
      };
      entry.journals?.push(journal);
      entry.journal ??= journal;
    } else if (event.eventType === 'study') {
      entry.otherRecords?.push({ id: event.id, type: '学习', title: event.title });
    } else {
      entry.otherRecords?.push({ id: event.id, type: event.originalEventType, title: event.title });
    }
  }
  entry.todos.sort((left, right) => (
    TODO_RECURRENCE_ORDER[left.recurrence ?? 'none'] - TODO_RECURRENCE_ORDER[right.recurrence ?? 'none']
  ));
  return entry;
}
