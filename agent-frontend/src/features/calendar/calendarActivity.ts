/** 活力仅衡量已记录的活动；固定档位保证跨月可比较。 */
export function calendarActivity(input: {
  studySeconds: number;
  completedTodos: number;
  records: number;
  available: boolean;
  future: boolean;
}): { score: number; level: number } | null {
  if (!input.available) return null;
  if (input.future) return { score: 0, level: 0 };
  const score =
    Math.min(40, Math.floor(Math.max(0, input.studySeconds) / 1800) * 10) +
    Math.min(30, Math.max(0, input.completedTodos) * 10) +
    Math.min(30, Math.max(0, input.records) * 10);
  return { score, level: score === 0 ? 0 : Math.ceil(score / 25) };
}
