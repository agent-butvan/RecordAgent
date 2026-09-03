export type TodoPriority = 'high' | 'medium' | 'low';

export interface CalendarTodo {
  id: string;
  title: string;
  time?: string;
  priority: TodoPriority;
  completed: boolean;
  version?: number;
}

export interface CalendarExpense {
  id: string;
  version?: number;
  category: string;
  note: string;
  amount: number;
  time: string;
  color: 'orange' | 'blue' | 'violet';
}

export interface CalendarSchedule {
  id: string;
  version?: number;
  title: string;
  startTime: string;
  endTime: string;
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
  schedules: CalendarSchedule[];
  journal?: CalendarJournal;
  photos: CalendarPhoto[];
  otherRecords?: CalendarOtherRecord[];
}

export type CalendarRecordDraft =
  | { kind: 'todo'; title: string; time?: string; priority: TodoPriority }
  | { kind: 'schedule'; title: string; startTime: string; endTime: string; location?: string }
  | { kind: 'expense'; category: string; note: string; amount: number; time: string }
  | { kind: 'journal'; title?: string; excerpt: string; mood: string };
