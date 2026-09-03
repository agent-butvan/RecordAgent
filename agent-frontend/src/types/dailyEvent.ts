export interface DailyEventBase {
  id: string;
  eventDate: string;
  title: string;
  source: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TodoDailyEvent extends DailyEventBase {
  eventType: 'todo';
  details: { time: string | null; priority: 'high' | 'medium' | 'low'; completed: boolean };
}

export interface ScheduleDailyEvent extends DailyEventBase {
  eventType: 'schedule';
  details: { startTime: string; endTime: string; location: string | null; timezone: string };
}

export interface ExpenseDailyEvent extends DailyEventBase {
  eventType: 'expense';
  details: { category: string; note: string; amount: number; time: string; currency: string };
}

export interface JournalDailyEvent extends DailyEventBase {
  eventType: 'journal';
  details: { body: string; mood: string };
}

export interface UnknownDailyEvent extends DailyEventBase {
  eventType: 'unknown';
  originalEventType: string;
  details: Record<string, unknown> | null;
}

export type DailyEvent =
  | TodoDailyEvent
  | ScheduleDailyEvent
  | ExpenseDailyEvent
  | JournalDailyEvent
  | UnknownDailyEvent;

export interface DailyDay {
  date: string;
  events: DailyEvent[];
}

export interface DailyDaySummary {
  date: string;
  eventCount: number;
  todoCount: number;
  completedTodoCount: number;
  scheduleCount: number;
  expenseTotal: number;
  headline: string;
}
