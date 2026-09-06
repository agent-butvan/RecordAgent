export type TodoPriority = 'high' | 'medium' | 'low';
export type TodoRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface CalendarTodo {
  id: string;
  title: string;
  time?: string;
  priority: TodoPriority;
  completed: boolean;
  recurrence?: TodoRecurrence;
  version?: number;
}

export interface CalendarExpense {
  id: string;
  version?: number;
  source?: string;
  category: string;
  note: string;
  amount: number;
  time: string;
  color: 'orange' | 'blue' | 'violet';
}

export interface CalendarIncome {
  id: string;
  source: string;
  category: string;
  note: string;
  amount: number;
  time: string;
}

export interface CalendarSchedule {
  id: string;
  version?: number;
  title: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  color: 'blue' | 'violet' | 'orange';
}

export interface CalendarPhoto {
  id: string;
  url: string;
  alt: string;
}

export interface CalendarJournal {
  id?: string;
  version?: number;
  source?: string;
  title?: string;
  excerpt: string;
  mood: string;
  updatedAt?: string;
}

export interface CalendarOtherRecord {
  id: string;
  type: string;
  title: string;
}

export interface CalendarDayEntry {
  todos: CalendarTodo[];
  expenses: CalendarExpense[];
  incomes: CalendarIncome[];
  schedules: CalendarSchedule[];
  journal?: CalendarJournal;
  journals?: CalendarJournal[];
  photos: CalendarPhoto[];
  otherRecords?: CalendarOtherRecord[];
}

export type CalendarRecordDraft =
  | { kind: 'todo'; title: string; time?: string; priority: TodoPriority; recurrence: TodoRecurrence }
  | { kind: 'schedule'; title: string; startTime?: string; endTime?: string; location?: string }
  | { kind: 'expense'; category: string; note: string; amount: number; time: string }
  | { kind: 'journal'; title?: string; excerpt: string; mood: string };
