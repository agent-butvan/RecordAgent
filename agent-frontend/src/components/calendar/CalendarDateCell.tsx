import type { DailyDaySummary } from '../../types/dailyEvent';
import { calendarActivity } from '../../features/calendar/calendarActivity';
import { formatStudyDuration } from './calendarPresentation';
import styles from './CalendarDateCell.module.css';

interface Props {
  date: Date;
  dateKey: string;
  inMonth: boolean;
  today: boolean;
  future: boolean;
  selected: boolean;
  available: boolean;
  previewOpen: boolean;
  summary?: DailyDaySummary;
  studySeconds?: number;
  recordCount?: number;
  onSelect: () => void;
  onPreview: (anchor: HTMLButtonElement, immediate: boolean) => void;
  onLeave: () => void;
}
/** 月历只保留重点摘要，活力底色与今天、选中状态相互独立。 */
export function CalendarDateCell({
  date,
  dateKey,
  inMonth,
  today,
  future,
  selected,
  available,
  previewOpen,
  summary,
  studySeconds = 0,
  recordCount = 0,
  onSelect,
  onPreview,
  onLeave,
}: Props) {
  const todos = summary?.todoCount ?? 0;
  const completed = summary?.completedTodoCount ?? 0;
  const expense = summary?.expenseTotal ?? 0;
  const activity = calendarActivity({
    studySeconds,
    completedTodos: completed,
    records: recordCount,
    available,
    future,
  });
  const headline =
    studySeconds > 0
      ? `学习 ${formatStudyDuration(studySeconds)}`
      : recordCount > 0
        ? `${recordCount} 篇资料`
        : summary?.scheduleCount
          ? `${summary.scheduleCount} 个日程`
          : expense > 0
            ? `支出 ¥${expense.toFixed(expense < 10 ? 2 : 0)}`
            : todos > 0
              ? `${completed}/${todos} 待办`
              : '';
  const meta = [
    todos > 0 && !headline.includes('待办')
      ? `待办 ${completed}/${todos}`
      : null,
    recordCount > 0 && !headline.includes('资料')
      ? `资料 ${recordCount}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <button
      type="button"
      className={[
        styles.cell,
        !inMonth ? styles.outside : '',
        selected ? styles.selected : '',
        inMonth && activity ? styles[`level${activity.level}`] : '',
        inMonth && !activity ? styles.unavailable : '',
      ].join(' ')}
      onMouseEnter={(event) => onPreview(event.currentTarget, false)}
      onMouseLeave={onLeave}
      onFocus={(event) => {
        if (event.currentTarget.matches(':focus-visible'))
          onPreview(event.currentTarget, true);
      }}
      onBlur={onLeave}
      onClick={onSelect}
      aria-pressed={selected}
      aria-current={today ? 'date' : undefined}
      aria-expanded={previewOpen}
      aria-controls={previewOpen ? 'calendar-day-preview' : undefined}
      aria-label={`${dateKey}，${headline}，${meta}，${activity ? `活力 ${activity.score} 分` : '活力数据暂不可用'}`}
    >
      <span className={`${styles.number} ${today ? styles.today : ''}`}>
        {date.getDate()}
      </span>
      {inMonth && (
        <span className={styles.metrics}>
          <span className={styles.headline}>{headline}</span>
          <span className={styles.meta}>{meta}</span>
        </span>
      )}
      {inMonth && !activity && (
        <span className={styles.unavailableMark} aria-hidden="true">
          ·
        </span>
      )}
    </button>
  );
}
