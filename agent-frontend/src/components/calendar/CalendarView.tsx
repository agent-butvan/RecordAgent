import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Image,
  MapPin,
  NotebookPen,
  ReceiptText,
  WalletCards,
} from 'lucide-react';
import type { CalendarDayEntry } from '../../types/calendar';
import { DailyTodoList } from './DailyTodoList';
import { calendarDateKey, createCalendarDemoData } from './calendarDemoData';
import styles from './CalendarView.module.css';

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];
const WEEKDAY_FULL = '日一二三四五六';
const WEEK_STARTS_ON = 1;
const GRID_SIZE = 42;

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, amount: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function totalExpense(entry: CalendarDayEntry): number {
  return entry.expenses.reduce((total, expense) => total + expense.amount, 0);
}

const EMPTY_ENTRY: CalendarDayEntry = { todos: [], expenses: [], schedules: [], photos: [] };

/** 日记录原型：月历负责浏览，每日详情聚合待办、花销、手记、图片和日程。 */
export const CalendarView: React.FC = () => {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [cursor, setCursor] = useState(today);
  const [selected, setSelected] = useState(today);
  const [entries, setEntries] = useState(() => createCalendarDemoData(today));

  const days = useMemo(() => {
    const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const leadingOffset = (firstOfMonth.getDay() - WEEK_STARTS_ON + 7) % 7;
    const gridStart = addDays(firstOfMonth, -leadingOffset);
    return Array.from({ length: GRID_SIZE }, (_, index) => addDays(gridStart, index));
  }, [cursor]);

  const selectedKey = calendarDateKey(selected);
  const selectedEntry = entries[selectedKey] ?? EMPTY_ENTRY;
  const completedCount = selectedEntry.todos.filter((todo) => todo.completed).length;
  const hasDailyRecord = Boolean(
    selectedEntry.todos.length
    || selectedEntry.expenses.length
    || selectedEntry.schedules.length
    || selectedEntry.journal
    || selectedEntry.photos.length,
  );
  const selectedLabel = `${selected.getFullYear()}年${selected.getMonth() + 1}月${selected.getDate()}日 · 星期${WEEKDAY_FULL[selected.getDay()]}`;

  const moveMonth = (delta: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));

  const goToday = () => {
    setCursor(today);
    setSelected(today);
  };

  const toggleTodo = (todoId: string) => {
    setEntries((current) => {
      const entry = current[selectedKey];
      if (!entry) return current;
      return {
        ...current,
        [selectedKey]: {
          ...entry,
          todos: entry.todos.map((todo) => (todo.id === todoId ? { ...todo, completed: !todo.completed } : todo)),
        },
      };
    });
  };

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>我的日历</h1>
            <p className={styles.subtitle}>把每一天的安排、花费和瞬间放在一起。</p>
          </div>
          <div className={styles.controls}>
            <button type="button" className={styles.todayBtn} onClick={goToday}>今天</button>
            <div className={styles.navGroup}>
              <button type="button" className={styles.navBtn} title="上个月" aria-label="上个月" onClick={() => moveMonth(-1)}><ChevronLeft size={17} /></button>
              <button type="button" className={styles.navBtn} title="下个月" aria-label="下个月" onClick={() => moveMonth(1)}><ChevronRight size={17} /></button>
            </div>
          </div>
        </header>

        <div className={styles.calendarLayout}>
          <section className={styles.monthPanel} aria-label="月历">
            <div className={styles.monthTitleRow}>
              <h2>{cursor.getFullYear()}年{cursor.getMonth() + 1}月</h2>
              <span>演示数据</span>
            </div>
            <div className={styles.weekHeader}>
              {WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
            </div>
            <div className={styles.grid}>
              {days.map((day) => {
                const inMonth = day.getMonth() === cursor.getMonth();
                const isToday = isSameDay(day, today);
                const isSelected = isSameDay(day, selected);
                const entry = entries[calendarDateKey(day)];
                const hasContent = Boolean(entry && (entry.todos.length || entry.expenses.length || entry.schedules.length || entry.journal || entry.photos.length));
                const dayPreview = entry?.schedules[0]?.title
                  ?? entry?.todos.find((todo) => !todo.completed)?.title
                  ?? (entry?.expenses.length ? `支出 ¥${totalExpense(entry).toFixed(0)}` : entry?.journal ? '写下手记' : '记录照片');
                return (
                  <button
                    key={calendarDateKey(day)}
                    type="button"
                    className={[styles.dayCell, inMonth ? '' : styles.dayCellOutside, isToday ? styles.dayCellToday : '', isSelected ? styles.dayCellSelected : ''].join(' ')}
                    onClick={() => setSelected(startOfDay(day))}
                    aria-pressed={isSelected}
                    aria-label={`${day.getMonth() + 1}月${day.getDate()}日${hasContent ? '，有日记录' : ''}`}
                  >
                    <span className={styles.dayNumber}>{day.getDate()}</span>
                    {hasContent && <span className={styles.dayContent}>
                      <span className={styles.daySignals} aria-hidden="true">
                        {entry?.schedules.length ? <i className={styles.signalSchedule} /> : null}
                        {entry?.todos.length ? <i className={styles.signalTodo} /> : null}
                        {entry?.expenses.length ? <i className={styles.signalExpense} /> : null}
                      </span>
                      <span className={styles.dayPreview}>{dayPreview}</span>
                    </span>}
                  </button>
                );
              })}
            </div>
            <div className={styles.legend}>
              <span><i className={styles.signalSchedule} />日程</span>
              <span><i className={styles.signalTodo} />待办</span>
              <span><i className={styles.signalExpense} />花销</span>
            </div>
          </section>

          <section className={styles.dayPanel} aria-label={`${selectedLabel}的日记录`}>
            <div className={styles.dayHeading}>
              <div>
                <h2>{selectedLabel}</h2>
                <p>{hasDailyRecord ? '这是今天留下的生活切片。' : '这一天还没有留下记录。'}</p>
              </div>
              <span className={styles.demoBadge}>模拟数据</span>
            </div>

            <div className={styles.summaryLine} aria-label="当天汇总">
              <span><CheckCheck size={15} /><strong>{completedCount}/{selectedEntry.todos.length || 0}</strong> 待办完成</span>
              <span><WalletCards size={15} /><strong>¥{totalExpense(selectedEntry).toFixed(2)}</strong> 今日支出</span>
              <span><Clock3 size={15} /><strong>{selectedEntry.schedules.length}</strong> 个日程</span>
            </div>

            {hasDailyRecord ? <div className={styles.recordSections}>
              <section className={styles.recordSection}>
                <div className={styles.sectionHeading}><span className={styles.iconBox}><CheckCheck size={15} /></span><h3>今日待办</h3></div>
                <DailyTodoList todos={selectedEntry.todos} onToggle={toggleTodo} />
              </section>

              <section className={styles.recordSection}>
                <div className={styles.sectionHeading}><span className={styles.iconBox}><Clock3 size={15} /></span><h3>日程</h3></div>
                {selectedEntry.schedules.length ? <div className={styles.scheduleList}>
                  {selectedEntry.schedules.map((schedule) => <div key={schedule.id} className={styles.scheduleItem}>
                    <span className={`${styles.scheduleDot} ${styles[`schedule${schedule.color[0].toUpperCase()}${schedule.color.slice(1)}`]}`} />
                    <span className={styles.scheduleTime}>{schedule.startTime}<br />{schedule.endTime}</span>
                    <span className={styles.scheduleBody}><strong>{schedule.title}</strong>{schedule.location && <small><MapPin size={11} />{schedule.location}</small>}</span>
                  </div>)}
                </div> : <p className={styles.emptyText}>今天没有日程安排。</p>}
              </section>

              <section className={styles.recordSection}>
                <div className={styles.sectionHeading}><span className={styles.iconBox}><ReceiptText size={15} /></span><h3>花销明细</h3><span className={styles.sectionTotal}>共 ¥{totalExpense(selectedEntry).toFixed(2)}</span></div>
                {selectedEntry.expenses.length ? <div className={styles.expenseList}>
                  {selectedEntry.expenses.map((expense) => <div key={expense.id} className={styles.expenseItem}>
                    <span className={`${styles.expenseIcon} ${styles[`expense${expense.color[0].toUpperCase()}${expense.color.slice(1)}`]}`}>{expense.category.slice(0, 1)}</span>
                    <span className={styles.expenseBody}><strong>{expense.category}</strong><small>{expense.note} · {expense.time}</small></span>
                    <strong className={styles.expenseAmount}>-¥{expense.amount.toFixed(2)}</strong>
                  </div>)}
                </div> : <p className={styles.emptyText}>没有记录花销。</p>}
              </section>

              {(selectedEntry.journal || selectedEntry.photos.length > 0) && <section className={styles.recordSection}>
                <div className={styles.sectionHeading}><span className={styles.iconBox}><NotebookPen size={15} /></span><h3>手记与图片</h3></div>
                {selectedEntry.journal && <div className={styles.journal}><p>“{selectedEntry.journal.excerpt}”</p><span>{selectedEntry.journal.mood}</span></div>}
                {selectedEntry.photos.length > 0 && <div className={styles.photoGrid}>
                  {selectedEntry.photos.map((photo) => <img key={photo.id} src={photo.url} alt={photo.alt} />)}
                  <span className={styles.photoCount}><Image size={13} />{selectedEntry.photos.length} 张</span>
                </div>}
              </section>}
            </div> : <div className={styles.emptyDay}>
              <CalendarDays size={20} aria-hidden="true" />
              <strong>给这一天留下一点什么</strong>
              <p>待办、日程、花销、手记和图片都会在这里汇总。</p>
            </div>}
          </section>
        </div>
      </div>
    </main>
  );
};

export default CalendarView;
