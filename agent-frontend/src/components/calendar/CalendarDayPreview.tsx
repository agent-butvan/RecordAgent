import React from 'react';
import type { CalendarDayEntry } from '../../types/calendar';
import styles from './CalendarDayPreview.module.css';

interface CalendarDayPreviewProps {
  date: Date;
  entry: CalendarDayEntry;
  id: string;
  alignRight?: boolean;
}

const WEEKDAY_FULL = '日一二三四五六';
type PreviewTone = 'schedule' | 'todo' | 'expense' | 'income' | 'neutral';

const TAG_TONE_CLASSES: Record<PreviewTone, string> = {
  schedule: styles.tagSchedule,
  todo: styles.tagTodo,
  expense: styles.tagExpense,
  income: styles.tagIncome,
  neutral: styles.tagNeutral,
};

/** 月历日期悬浮预览：只展示当天最重要的摘要，不替代右侧完整详情。 */
export const CalendarDayPreview: React.FC<CalendarDayPreviewProps> = ({ date, entry, id, alignRight = false }) => {
  const completedTodos = entry.todos.filter((todo) => todo.completed).length;
  const expenseTotal = entry.expenses.reduce((total, expense) => total + expense.amount, 0);
  const incomeTotal = entry.incomes.reduce((total, income) => total + income.amount, 0);
  const recordCount = entry.todos.length
    + entry.schedules.length
    + entry.expenses.length
    + entry.incomes.length
    + entry.photos.length
    + (entry.journal ? 1 : 0)
    + (entry.otherRecords?.length ?? 0);
  const previewItems = [
    entry.schedules[0] ? {
      label: '日程',
      tone: 'schedule' as const,
      text: entry.schedules[0].title,
      meta: entry.schedules[0].startTime,
    } : null,
    entry.todos[0] ? {
      label: '待办',
      tone: 'todo' as const,
      text: entry.todos.find((todo) => !todo.completed)?.title ?? entry.todos[0].title,
      meta: `${completedTodos}/${entry.todos.length}`,
    } : null,
    entry.expenses.length ? {
      label: '支出',
      tone: 'expense' as const,
      text: entry.expenses[0].note,
      meta: `¥${expenseTotal.toFixed(2)}`,
    } : null,
    entry.incomes.length ? {
      label: '收入',
      tone: 'income' as const,
      text: entry.incomes[0].note,
      meta: `¥${incomeTotal.toFixed(2)}`,
    } : null,
    entry.journal ? {
      label: '手记',
      tone: 'neutral' as const,
      text: entry.journal.excerpt,
      meta: entry.journal.mood,
    } : entry.photos.length ? {
      label: '图片',
      tone: 'neutral' as const,
      text: entry.photos[0].alt,
      meta: `${entry.photos.length} 张`,
    } : entry.otherRecords?.[0] ? {
      label: entry.otherRecords[0].type,
      tone: 'neutral' as const,
      text: entry.otherRecords[0].title,
      meta: '扩展记录',
    } : null,
  ].filter((item): item is { label: string; tone: PreviewTone; text: string; meta: string } => item !== null).slice(0, 3);

  return (
    <span
      id={id}
      role="tooltip"
      className={`${styles.preview} ${alignRight ? styles.alignRight : ''}`}
    >
      <span className={styles.heading}>
        <strong>{date.getMonth() + 1}月{date.getDate()}日 · 星期{WEEKDAY_FULL[date.getDay()]}</strong>
        <small>{recordCount} 项记录</small>
      </span>
      <span className={styles.summary}>
        {entry.todos.length > 0 && <span>待办 {completedTodos}/{entry.todos.length}</span>}
        {entry.schedules.length > 0 && <span>日程 {entry.schedules.length}</span>}
        {entry.expenses.length > 0 && <span>支出 ¥{expenseTotal.toFixed(0)}</span>}
        {entry.incomes.length > 0 && <span>收入 ¥{incomeTotal.toFixed(0)}</span>}
      </span>
      <span className={styles.items}>
        {previewItems.map((item) => (
          <span className={styles.item} key={item.label}>
            <small className={`${styles.tag} ${TAG_TONE_CLASSES[item.tone]}`}>{item.label}</small>
            <span>{item.text}</span>
            <em>{item.meta}</em>
          </span>
        ))}
      </span>
      <span className={styles.hint}>点击查看当天完整记录</span>
    </span>
  );
};

export default CalendarDayPreview;
