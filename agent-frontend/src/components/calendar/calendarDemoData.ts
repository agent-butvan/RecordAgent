import type { CalendarDayEntry } from '../../types/calendar';

const keyOf = (date: Date): string => date.toISOString().slice(0, 10);

const plusDays = (date: Date, amount: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const emptyEntry = (): CalendarDayEntry => ({
  todos: [],
  expenses: [],
  schedules: [],
  photos: [],
});

/** 日历首版展示用模拟数据，后续由日记录接口替换。 */
export const createCalendarDemoData = (today: Date): Record<string, CalendarDayEntry> => ({
  [keyOf(today)]: {
    todos: [
      { id: 'today-1', title: '整理本周项目笔记', time: '10:00', priority: 'high', completed: false },
      { id: 'today-2', title: '确认周三的产品评审', time: '14:30', priority: 'medium', completed: true },
      { id: 'today-3', title: '给妈妈打电话', time: '20:00', priority: 'low', completed: false },
    ],
    expenses: [
      { id: 'expense-1', category: '餐饮', note: '午餐 · 红烧牛肉面', amount: 28, time: '12:18', color: 'orange' },
      { id: 'expense-2', category: '出行', note: '地铁通勤', amount: 6, time: '08:42', color: 'blue' },
      { id: 'expense-3', category: '学习', note: '设计类电子书', amount: 36, time: '21:08', color: 'violet' },
    ],
    schedules: [
      { id: 'schedule-1', title: '产品方案同步', startTime: '09:30', endTime: '10:15', location: '线上会议', color: 'blue' },
      { id: 'schedule-2', title: '下班慢跑', startTime: '18:30', endTime: '19:15', location: '滨江步道', color: 'violet' },
    ],
    journal: {
      excerpt: '今天把想了很久的日历方向写清楚了。把琐碎的事情放回同一天看，才发现生活也有自己的节奏。',
      mood: '平静而充实',
    },
    photos: [
      {
        id: 'photo-1',
        url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80',
        alt: '咖啡杯与笔记本',
      },
      {
        id: 'photo-2',
        url: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=800&q=80',
        alt: '户外山景',
      },
    ],
  },
  [keyOf(plusDays(today, -2))]: {
    ...emptyEntry(),
    todos: [
      { id: 'past-1', title: '完成日历信息架构草图', priority: 'medium', completed: true },
      { id: 'past-2', title: '归档本月票据', priority: 'low', completed: true },
    ],
    expenses: [
      { id: 'past-expense', category: '日用', note: '超市采购', amount: 86.5, time: '19:24', color: 'orange' },
    ],
    journal: { excerpt: '留出一点时间收拾房间，脑子也跟着清爽起来。', mood: '轻松' },
  },
  [keyOf(plusDays(today, 2))]: {
    ...emptyEntry(),
    todos: [
      { id: 'future-1', title: '准备产品评审材料', time: '09:00', priority: 'high', completed: false },
      { id: 'future-2', title: '预约牙科洁牙', priority: 'medium', completed: false },
    ],
    schedules: [
      { id: 'future-schedule', title: '产品评审会', startTime: '15:00', endTime: '16:00', location: '3F 会议室', color: 'blue' },
    ],
  },
  [keyOf(plusDays(today, 5))]: {
    ...emptyEntry(),
    schedules: [
      { id: 'weekend-schedule', title: '朋友聚餐', startTime: '18:00', endTime: '21:00', location: '武康路', color: 'orange' },
    ],
    photos: [
      {
        id: 'weekend-photo',
        url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80',
        alt: '傍晚的山谷',
      },
    ],
  },
});

export const calendarDateKey = keyOf;
