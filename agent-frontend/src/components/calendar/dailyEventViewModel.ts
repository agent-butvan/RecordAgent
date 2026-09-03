import type { CalendarDayEntry } from '../../types/calendar';
import type { DailyDay } from '../../types/dailyEvent';

/** 将可扩展日记录联合类型适配为当前日历页面的展示模型。 */
export function toCalendarDayEntry(day: DailyDay): CalendarDayEntry {
  const entry: CalendarDayEntry = { todos: [], schedules: [], expenses: [], photos: [], otherRecords: [] };
  for (const event of day.events) {
    if (event.eventType === 'todo') {
      entry.todos.push({
        id: event.id,
        title: event.title,
        time: event.details.time ?? undefined,
        priority: event.details.priority,
        completed: event.details.completed,
        version: event.version,
      });
    } else if (event.eventType === 'schedule') {
      entry.schedules.push({
        id: event.id,
        version: event.version,
        title: event.title,
        startTime: event.details.startTime,
        endTime: event.details.endTime,
        location: event.details.location ?? undefined,
        color: 'blue',
      });
    } else if (event.eventType === 'expense') {
      entry.expenses.push({
        id: event.id,
        version: event.version,
        category: event.details.category,
        note: event.details.note,
        amount: event.details.amount,
        time: event.details.time,
        color: 'orange',
      });
    } else if (event.eventType === 'journal') {
      entry.journal = {
        id: event.id,
        version: event.version,
        title: event.title === '无标题记录' || event.title === '无标题手记' ? undefined : event.title,
        excerpt: event.details.body,
        mood: event.details.mood,
        updatedAt: event.updatedAt,
      };
    } else {
      entry.otherRecords?.push({ id: event.id, type: event.originalEventType, title: event.title });
    }
  }
  return entry;
}
