export interface DailyInsight {
  date: string;
  todos: {
    total: number;
    completed: number;
    pending: number;
  };
  scheduleCount: number;
  records: {
    createdCount: number;
  };
  finance: {
    expenseCount: number;
    expenseTotal: number;
    expenseCategories: Record<string, number>;
  };
  study: {
    durationSeconds: number;
    sessionCount: number;
  };
}
