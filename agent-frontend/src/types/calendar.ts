export type TodoPriority = 'high' | 'medium' | 'low';

export interface CalendarTodo {
  id: string;
  title: string;
  time?: string;
  priority: TodoPriority;
  completed: boolean;
}

export interface CalendarExpense {
  id: string;
  category: string;
  note: string;
  amount: number;
  time: string;
  color: 'orange' | 'blue' | 'violet';
}

export interface CalendarSchedule {
  id: string;
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

export interface CalendarDayEntry {
  todos: CalendarTodo[];
  expenses: CalendarExpense[];
  schedules: CalendarSchedule[];
  journal?: {
    excerpt: string;
    mood: string;
  };
  photos: CalendarPhoto[];
}
