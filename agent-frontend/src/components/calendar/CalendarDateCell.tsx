import { useEffect, useRef, useState } from 'react';
import type { DailyDaySummary } from '../../types/dailyEvent';
import { CalendarDayPreview } from './CalendarDayPreview';
import { formatStudyDuration } from './calendarPresentation';
import styles from './CalendarDateCell.module.css';

interface Props {
  date: Date;
  dateKey: string;
  inMonth: boolean;
  today: boolean;
  selected: boolean;
  summary?: DailyDaySummary;
  studySeconds?: number;
  recordCount?: number;
  onSelect: () => void;
}
/** 日期格展示可比较的指标；延迟关闭允许鼠标穿过间隙进入详情。 */
export function CalendarDateCell({
  date,
  dateKey,
  inMonth,
  today,
  selected,
  summary,
  studySeconds = 0,
  recordCount = 0,
  onSelect,
}: Props) {
  const anchor = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  const enter = () => {
    cancel();
    setOpen(true);
  };
  const leave = () => {
    cancel();
    timer.current = setTimeout(() => setOpen(false), 320);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const todos = summary?.todoCount ?? 0;
  const completed = summary?.completedTodoCount ?? 0;
  const expense = summary?.expenseTotal ?? 0;
  const active = !!(summary?.eventCount || studySeconds || recordCount);
  const id = `calendar-day-preview-${dateKey}`;
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className={[
          styles.cell,
          !inMonth ? styles.outside : '',
          selected ? styles.selected : '',
        ].join(' ')}
        onMouseEnter={() => {
          cancel();
          timer.current = setTimeout(enter, 550);
        }}
        onMouseLeave={leave}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) enter();
        }}
        onBlur={leave}
        onClick={() => {
          onSelect();
          enter();
        }}
        aria-pressed={selected}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`${dateKey}，待办完成${completed}/${todos}，支出${expense.toFixed(2)}元，学习${formatStudyDuration(studySeconds)}，资料${recordCount}篇`}
      >
        <span className={`${styles.number} ${today ? styles.today : ''}`}>
          {date.getDate()}
        </span>
        {inMonth && active && (
          <span className={styles.metrics}>
            <span className={styles.signals} aria-hidden="true">
              {todos > 0 && <i className={styles.todoDot} />}
              {expense > 0 && <i className={styles.expenseDot} />}
              {studySeconds > 0 && <i className={styles.studyDot} />}
              {recordCount > 0 && <i className={styles.recordDot} />}
            </span>
            <span className={studySeconds > 0 ? styles.study : styles.headline}>
              {studySeconds > 0
                ? `学习 ${formatStudyDuration(studySeconds)}`
                : expense > 0
                  ? `支出 ¥${expense.toFixed(expense < 10 ? 2 : 0)}`
                  : summary?.scheduleCount
                    ? `${summary.scheduleCount} 个日程`
                    : recordCount > 0
                      ? `${recordCount} 篇资料`
                      : `${completed}/${todos} 待办`}
            </span>
            <span className={styles.meta}>
              {[
                todos > 0 ? `${completed}/${todos} 待办` : null,
                studySeconds > 0 && expense > 0
                  ? `¥${expense.toFixed(expense < 10 ? 2 : 0)}`
                  : recordCount > 0
                    ? `${recordCount} 篇资料`
                    : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
        )}
      </button>
      {open && anchor.current && (
        <CalendarDayPreview
          date={date}
          id={id}
          anchor={anchor.current}
          onEnter={enter}
          onLeave={leave}
          onClose={() => {
            cancel();
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
