import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { CalendarDayEntry, CalendarJournal, CalendarRecordDraft } from '../../types/calendar';
import type { DailyDaySummary } from '../../types/dailyEvent';
import {
  createDailyRecord,
  deleteDailyEvent,
  fetchDailyDay,
  fetchDailySummaries,
  formatLocalDate,
  setDailyTodoCompleted,
  updateDailyJournal,
} from '../../services/dailyEvents';
import { Button } from '../common/Button';
import { Message } from '../common/Message';
import { Modal } from '../common/Modal';
import { TopBar } from '../common/TopBar';
import { CalendarDayPreview } from './CalendarDayPreview';
import { CalendarQuickCreate } from './CalendarQuickCreate';
import { DailyCashflowList } from './DailyCashflowList';
import { DailyRecordDeleteButton } from './DailyRecordDeleteButton';
import { DailyTodoList } from './DailyTodoList';
import { JournalEditorPage } from './JournalEditorPage';
import { toCalendarDayEntry } from './dailyEventViewModel';
import styles from './CalendarView.module.css';

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];
const WEEKDAY_FULL = '日一二三四五六';
const WEEK_STARTS_ON = 1;
const GRID_SIZE = 42;

interface DeleteTarget {
  id: string;
  version: number;
  kind: '待办' | '日程' | '花销' | '手记';
  title: string;
}

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

function totalIncome(entry: CalendarDayEntry): number {
  return entry.incomes.reduce((total, income) => total + income.amount, 0);
}

function hasEntryContent(entry: CalendarDayEntry): boolean {
  return Boolean(
    entry.todos.length
    || entry.expenses.length
    || entry.incomes.length
    || entry.schedules.length
    || entry.journals?.length
    || entry.journal
    || entry.photos.length
    || entry.otherRecords?.length,
  );
}

const EMPTY_ENTRY: CalendarDayEntry = { todos: [], expenses: [], incomes: [], schedules: [], journals: [], photos: [], otherRecords: [] };

interface CalendarViewProps {
  onOpenFinance: () => void;
}

/** 日记录原型：月历负责浏览，每日详情聚合待办、花销、手记、图片和日程。 */
export const CalendarView: React.FC<CalendarViewProps> = ({ onOpenFinance }) => {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [cursor, setCursor] = useState(today);
  const [selected, setSelected] = useState(today);
  const [entries, setEntries] = useState<Record<string, CalendarDayEntry>>({});
  const [summaries, setSummaries] = useState<Record<string, DailyDaySummary>>({});
  const [isDayLoading, setIsDayLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [journalEditorDate, setJournalEditorDate] = useState<Date | null>(null);
  const [journalEditorId, setJournalEditorId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCashflowModalOpen, setIsCashflowModalOpen] = useState(false);

  const days = useMemo(() => {
    const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const leadingOffset = (firstOfMonth.getDay() - WEEK_STARTS_ON + 7) % 7;
    const gridStart = addDays(firstOfMonth, -leadingOffset);
    return Array.from({ length: GRID_SIZE }, (_, index) => addDays(gridStart, index));
  }, [cursor]);

  const monthRecords = useMemo(() => Object.values(summaries), [summaries]);
  const todayKey = formatLocalDate(today);
  const monthTodoRecords = monthRecords.filter((record) => record.date <= todayKey);
  const monthTodoTotal = monthTodoRecords.reduce((total, record) => total + record.todoCount, 0);
  const monthTodoCompleted = monthTodoRecords.reduce((total, record) => total + record.completedTodoCount, 0);
  const monthTodoRate = monthTodoTotal ? Math.round((monthTodoCompleted / monthTodoTotal) * 100) : 0;
  const monthExpenseTotal = monthRecords.reduce((total, record) => total + record.expenseTotal, 0);

  const selectedKey = formatLocalDate(selected);
  const selectedEntry = entries[selectedKey] ?? EMPTY_ENTRY;
  const selectedJournals = selectedEntry.journals ?? (selectedEntry.journal ? [selectedEntry.journal] : []);
  const completedCount = selectedEntry.todos.filter((todo) => todo.completed).length;
  const selectedCashflowCount = selectedEntry.expenses.length + selectedEntry.incomes.length;
  const hasDailyRecord = Boolean(
    selectedEntry.todos.length
    || selectedEntry.expenses.length
    || selectedEntry.incomes.length
    || selectedEntry.schedules.length
    || selectedJournals.length
    || selectedEntry.photos.length
    || selectedEntry.otherRecords?.length,
  );
  const selectedLabel = `${selected.getFullYear()}年${selected.getMonth() + 1}月${selected.getDate()}日 · 星期${WEEKDAY_FULL[selected.getDay()]}`;

  const moveMonth = (delta: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));

  const goToday = () => {
    setCursor(today);
    setSelected(today);
  };

  const loadDay = useCallback(async (date: Date) => {
    const key = formatLocalDate(date);
    const day = await fetchDailyDay(date);
    setEntries((current) => ({ ...current, [key]: toCalendarDayEntry(day) }));
  }, []);

  const loadMonth = useCallback(async () => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const items = await fetchDailySummaries(first, last);
    setSummaries(Object.fromEntries(items.map((item) => [item.date, item])));
  }, [cursor]);

  useEffect(() => {
    let active = true;
    setIsDayLoading(true);
    setDataError(null);
    fetchDailyDay(selected)
      .then((day) => {
        if (active) setEntries((current) => ({ ...current, [day.date]: toCalendarDayEntry(day) }));
      })
      .catch((error: unknown) => {
        if (active) setDataError(error instanceof Error ? error.message : '读取日记录失败');
      })
      .finally(() => {
        if (active) setIsDayLoading(false);
      });
    return () => { active = false; };
  }, [selected]);

  useEffect(() => {
    let active = true;
    setDataError(null);
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    fetchDailySummaries(first, last)
      .then((items) => {
        if (active) setSummaries(Object.fromEntries(items.map((item) => [item.date, item])));
      })
      .catch((error: unknown) => {
        if (active) setDataError(error instanceof Error ? error.message : '读取月度摘要失败');
      });
    return () => { active = false; };
  }, [cursor]);

  const refreshSelectedAndMonth = async () => {
    await Promise.all([loadDay(selected), loadMonth()]);
  };

  const toggleTodo = async (todoId: string) => {
    const todo = selectedEntry.todos.find((item) => item.id === todoId);
    if (!todo) return;
    try {
      setDataError(null);
      await setDailyTodoCompleted(todo.id, !todo.completed, todo.version ?? 0, selected);
      await refreshSelectedAndMonth();
    } catch (error: unknown) {
      setDataError(error instanceof Error ? error.message : '修改待办失败');
    }
  };

  const createRecord = async (draft: CalendarRecordDraft) => {
    try {
      setDataError(null);
      await createDailyRecord(selected, draft);
      await refreshSelectedAndMonth();
    } catch (error: unknown) {
      setDataError(error instanceof Error ? error.message : '创建日记录失败');
    }
  };

  const requestDelete = (
    record: { id?: string; version?: number },
    kind: DeleteTarget['kind'],
    title: string,
  ) => {
    if (!record.id || record.version === undefined) {
      setDataError(`缺少${kind}版本信息，无法安全删除，请刷新后重试`);
      return;
    }
    setDeleteError(null);
    setDeleteTarget({ id: record.id, version: record.version, kind, title });
  };

  const closeDeleteDialog = () => {
    if (isDeleting) return;
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteDailyEvent(deleteTarget.id, deleteTarget.version);
      setDeleteTarget(null);
      setDataError(null);
      try {
        await refreshSelectedAndMonth();
      } catch (error: unknown) {
        setDataError(error instanceof Error ? `记录已删除，但刷新失败：${error.message}` : '记录已删除，但刷新失败');
      }
    } catch (error: unknown) {
      setDeleteError(error instanceof Error ? error.message : `删除${deleteTarget.kind}失败`);
    } finally {
      setIsDeleting(false);
    }
  };

  const saveJournal = async (journal: CalendarJournal) => {
    if (!journalEditorDate) return;
    try {
      setDataError(null);
      const editorEntry = entries[formatLocalDate(journalEditorDate)];
      const journals = editorEntry?.journals ?? (editorEntry?.journal ? [editorEntry.journal] : []);
      const existing = journals.find((item) => item.id === journalEditorId);
      if (existing?.id) {
        await updateDailyJournal(journalEditorDate, { ...journal, id: existing.id, version: existing.version });
      } else {
        await createDailyRecord(journalEditorDate, {
          kind: 'journal', title: journal.title, excerpt: journal.excerpt, mood: journal.mood,
        });
      }
      await loadDay(journalEditorDate);
      await loadMonth();
      setSelected(journalEditorDate);
      setJournalEditorDate(null);
      setJournalEditorId(null);
    } catch (error: unknown) {
      setDataError(error instanceof Error ? error.message : '保存手记失败');
    }
  };

  if (journalEditorDate) {
    const journalKey = formatLocalDate(journalEditorDate);
    const journalEntry = entries[journalKey];
    const journals = journalEntry?.journals ?? (journalEntry?.journal ? [journalEntry.journal] : []);
    return (
      <JournalEditorPage
        date={journalEditorDate}
        initialJournal={journals.find((item) => item.id === journalEditorId)}
        onBack={() => { setJournalEditorDate(null); setJournalEditorId(null); }}
        onSave={saveJournal}
        error={dataError}
      />
    );
  }

  return (
    <main className={styles.workspace}>
      <TopBar
        icon={<CalendarDays size={16} strokeWidth={1.8} />}
        title="日历"
        subtitle="本地数据"
        actions={(
          <div className={styles.controls}>
            <CalendarQuickCreate
              selectedDate={selected}
              onCreate={createRecord}
              onWriteJournal={() => {
                setJournalEditorId(selectedJournals.find((journal) => journal.source !== 'record')?.id ?? null);
                setJournalEditorDate(selected);
              }}
              onOpenFinance={onOpenFinance}
            />
            <button type="button" className={styles.todayBtn} onClick={goToday}>今天</button>
            <div className={styles.navGroup}>
              <button type="button" className={styles.navBtn} title="上个月" aria-label="上个月" onClick={() => moveMonth(-1)}><ChevronLeft size={17} /></button>
              <button type="button" className={styles.navBtn} title="下个月" aria-label="下个月" onClick={() => moveMonth(1)}><ChevronRight size={17} /></button>
            </div>
          </div>
        )}
      />
      <div className={styles.page}>
        <div className={styles.content}>
          {dataError && <div className={styles.dataError} role="alert">{dataError}</div>}
          <div className={styles.calendarLayout}>
            <section className={styles.monthPanel} aria-label="月历">
              <div className={styles.monthTitleRow}>
                <h2>{cursor.getFullYear()}年{cursor.getMonth() + 1}月</h2>
                <span>月视图</span>
              </div>
              <div className={styles.weekHeader}>
                {WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
              </div>
              <div className={styles.grid}>
                {days.map((day, index) => {
                  const inMonth = day.getMonth() === cursor.getMonth();
                  const isToday = isSameDay(day, today);
                  const isSelected = isSameDay(day, selected);
                  const dateKey = formatLocalDate(day);
                  const entry = entries[dateKey];
                  const summary = summaries[dateKey];
                  const hasContent = Boolean(summary?.eventCount || (entry && hasEntryContent(entry)));
                  const showPreview = Boolean(inMonth && entry && hasEntryContent(entry));
                  const completedTodos = summary?.completedTodoCount
                    ?? entry?.todos.filter((todo) => todo.completed).length
                    ?? 0;
                  const todoCount = summary?.todoCount ?? entry?.todos.length ?? 0;
                  const scheduleCount = summary?.scheduleCount ?? entry?.schedules.length ?? 0;
                  const expenseTotal = summary?.expenseTotal ?? (entry ? totalExpense(entry) : 0);
                  const dayPreview = summary?.headline
                    ?? entry?.schedules[0]?.title
                    ?? entry?.todos.find((todo) => !todo.completed)?.title
                    ?? entry?.otherRecords?.[0]?.title
                    ?? (entry?.expenses.length ? `支出 ¥${totalExpense(entry).toFixed(0)}` : entry?.journal ? '写下手记' : '记录照片');
                  const dayMeta = [
                    scheduleCount ? `${scheduleCount} 个日程` : null,
                    todoCount ? `${completedTodos}/${todoCount} 待办` : null,
                    expenseTotal ? `¥${expenseTotal.toFixed(0)}` : null,
                  ].filter(Boolean).slice(0, 2).join(' · ');
                  const previewId = `calendar-day-preview-${dateKey}`;
                  return (
                    <button
                      key={dateKey}
                      type="button"
                      className={[styles.dayCell, inMonth ? '' : styles.dayCellOutside, isToday ? styles.dayCellToday : '', isSelected ? styles.dayCellSelected : ''].join(' ')}
                      onClick={() => setSelected(startOfDay(day))}
                      aria-pressed={isSelected}
                      aria-describedby={showPreview ? previewId : undefined}
                      aria-label={`${day.getMonth() + 1}月${day.getDate()}日${hasContent ? '，有日记录' : ''}`}
                    >
                      <span className={styles.dayNumber}>{day.getDate()}</span>
                      {hasContent && <span className={styles.dayContent}>
                        <span className={styles.daySignals} aria-hidden="true">
                          {scheduleCount ? <i className={styles.signalSchedule} /> : null}
                          {todoCount ? <i className={styles.signalTodo} /> : null}
                          {expenseTotal ? <i className={styles.signalExpense} /> : null}
                        </span>
                        <span className={styles.dayPreview}>{dayPreview}</span>
                        <span className={styles.dayMeta}>{dayMeta}</span>
                      </span>}
                      {entry && showPreview && (
                        <CalendarDayPreview
                          id={previewId}
                          date={day}
                          entry={entry}
                          alignRight={index % 7 >= 5}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className={styles.legend}>
                <span><i className={styles.signalSchedule} />日程</span>
                <span><i className={styles.signalTodo} />待办</span>
                <span><i className={styles.signalExpense} />花销</span>
              </div>

              <section className={styles.monthReview} aria-label="本月回顾">
                <div className={styles.monthReviewHeading}>
                  <h3>本月回顾</h3>
                  <span>{monthRecords.length} 天有记录</span>
                </div>
                {monthRecords.length ? <>
                  <dl className={styles.monthStats}>
                    <div><dt>记录天数</dt><dd>{monthRecords.length}</dd></div>
                    <div><dt>待办完成</dt><dd>{monthTodoRate}%</dd></div>
                    <div><dt>本月支出</dt><dd>¥{monthExpenseTotal.toFixed(2)}</dd></div>
                  </dl>
                  <div className={styles.monthHighlights}>
                    <p>本月足迹</p>
                    <div className={styles.highlightList}>
                      {monthRecords.slice(0, 4).map((record) => {
                        const recordDate = new Date(`${record.date}T00:00:00`);
                        return (
                          <button
                            type="button"
                            key={record.date}
                            className={`${styles.highlightItem} ${isSameDay(recordDate, selected) ? styles.highlightItemActive : ''}`}
                            onClick={() => setSelected(startOfDay(recordDate))}
                          >
                            <span className={styles.highlightDate}>{String(recordDate.getDate()).padStart(2, '0')}</span>
                            <span className={styles.highlightText}>{record.headline}</span>
                            <ChevronRight size={13} aria-hidden="true" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </> : <p className={styles.monthReviewEmpty}>这个月还没有留下记录。</p>}
              </section>
            </section>

          <section className={styles.dayPanel} aria-label={`${selectedLabel}的日记录`}>
            <div className={styles.dayHeading}>
              <div>
                <h2>{selectedLabel}</h2>
                <p>{hasDailyRecord ? '当天记录' : '暂无记录'}</p>
              </div>
            </div>

            <div className={styles.summaryLine} aria-label="当天汇总">
              <span className={styles.todoSummary}><CheckCheck size={16} /><span><small>待办完成</small><strong>{completedCount}/{selectedEntry.todos.length || 0}</strong></span></span>
              <span className={styles.expenseSummary}><WalletCards size={16} /><span><small>今日支出</small><strong>¥{totalExpense(selectedEntry).toFixed(2)}</strong></span></span>
              <span className={styles.incomeSummary}><WalletCards size={16} /><span><small>今日收入</small><strong>¥{totalIncome(selectedEntry).toFixed(2)}</strong></span></span>
              <span className={styles.scheduleSummary}><Clock3 size={16} /><span><small>日程</small><strong>{selectedEntry.schedules.length} 个</strong></span></span>
            </div>

            {isDayLoading ? <div className={styles.emptyDay}>
              <CalendarDays size={20} aria-hidden="true" />
              <strong>正在读取日记录</strong>
            </div> : hasDailyRecord ? <div className={styles.recordSections}>
              <section className={styles.recordSection}>
                <div className={styles.sectionHeading}><CheckCheck size={15} aria-hidden="true" /><h3>待办事项</h3></div>
                <DailyTodoList
                  todos={selectedEntry.todos}
                  onToggle={toggleTodo}
                  onDelete={(todo) => requestDelete(todo, '待办', todo.title)}
                />
              </section>

              <section className={styles.recordSection}>
                <div className={styles.sectionHeading}><Clock3 size={15} aria-hidden="true" /><h3>日程</h3></div>
                {selectedEntry.schedules.length ? <div className={styles.scheduleList}>
                  {selectedEntry.schedules.map((schedule) => <div key={schedule.id} className={styles.scheduleItem}>
                    <span className={`${styles.scheduleDot} ${styles[`schedule${schedule.color[0].toUpperCase()}${schedule.color.slice(1)}`]}`} />
                    <span className={styles.scheduleTime}>
                      {schedule.startTime || schedule.endTime
                        ? <>{schedule.startTime ? `开始 ${schedule.startTime}` : '开始待定'}<br />{schedule.endTime ? `结束 ${schedule.endTime}` : '结束待定'}</>
                        : '时间待定'}
                    </span>
                    <span className={styles.scheduleBody}><strong>{schedule.title}</strong>{schedule.location && <small><MapPin size={11} />{schedule.location}</small>}</span>
                    <DailyRecordDeleteButton label={`日程“${schedule.title}”`} onDelete={() => requestDelete(schedule, '日程', schedule.title)} />
                  </div>)}
                </div> : <p className={styles.emptyText}>今天没有日程安排。</p>}
              </section>

              <section className={`${styles.recordSection} ${styles.cashflowSection}`}>
                <div className={styles.sectionHeading}><ReceiptText size={15} aria-hidden="true" /><h3>收支明细</h3>
                  <span className={styles.cashflowTotals}>
                    <b className={styles.expenseText}>支出 ¥{totalExpense(selectedEntry).toFixed(2)}</b>
                    <b className={styles.incomeText}>收入 ¥{totalIncome(selectedEntry).toFixed(2)}</b>
                  </span>
                </div>
                {selectedCashflowCount ? (
                  <DailyCashflowList
                    expenses={selectedEntry.expenses}
                    incomes={selectedEntry.incomes}
                    maxItems={3}
                    onViewAll={() => setIsCashflowModalOpen(true)}
                    onDeleteExpense={(record) => requestDelete(record, '花销', record.category)}
                  />
                ) : <p className={styles.emptyText}>没有收支记录。</p>}
              </section>

              {(selectedJournals.length > 0 || selectedEntry.photos.length > 0) && <section className={styles.recordSection}>
                <div className={styles.sectionHeading}>
                  <NotebookPen size={15} aria-hidden="true" />
                  <h3>手记与图片</h3>
                </div>
                {selectedJournals.length > 0 && <div className={styles.journalList}>{selectedJournals.map((journal) => <div className={styles.journal} key={journal.id ?? `${journal.updatedAt}-${journal.title}`}>
                  <div className={styles.journalHeading}>{journal.title && <strong>{journal.title}</strong>}
                    {journal.source === 'record' ? <span className={styles.syncedLabel}>来自记录</span> : <div className={styles.sectionActions}>
                      <button type="button" className={styles.journalEditButton} onClick={() => { setJournalEditorId(journal.id ?? null); setJournalEditorDate(selected); }}>编辑</button>
                      <DailyRecordDeleteButton label="手记" onDelete={() => requestDelete(journal, '手记', journal.title || '无标题手记')} />
                    </div>}
                  </div>
                  <p>{journal.excerpt}</p>
                  {journal.source !== 'record' && journal.mood && <span>{journal.mood}</span>}
                </div>)}</div>}
                {selectedEntry.photos.length > 0 && <div className={styles.photoGrid}>
                  {selectedEntry.photos.map((photo) => <img key={photo.id} src={photo.url} alt={photo.alt} />)}
                  <span className={styles.photoCount}><Image size={13} />{selectedEntry.photos.length} 张</span>
                </div>}
              </section>}

              {Boolean(selectedEntry.otherRecords?.length) && <section className={styles.recordSection}>
                <div className={styles.sectionHeading}><NotebookPen size={15} aria-hidden="true" /><h3>其他记录</h3></div>
                <div className={styles.scheduleList}>
                  {selectedEntry.otherRecords?.map((record) => <div key={record.id} className={styles.scheduleItem}>
                    <span className={`${styles.scheduleDot} ${styles.scheduleViolet}`} />
                    <span className={styles.scheduleTime}>{record.type}</span>
                    <span className={styles.scheduleBody}><strong>{record.title}</strong></span>
                  </div>)}
                </div>
              </section>}
            </div> : <div className={styles.emptyDay}>
              <CalendarDays size={20} aria-hidden="true" />
              <strong>给这一天留下一点什么</strong>
              <p>待办、日程、花销、手记和图片都会在这里汇总。</p>
            </div>}
          </section>
          </div>
        </div>
      </div>
      <Modal
        open={isCashflowModalOpen}
        title="当日收支明细"
        onClose={() => setIsCashflowModalOpen(false)}
        width={560}
        centered
      >
        <div className={styles.cashflowDialogSummary}>
          <span>{selectedLabel}</span>
          <strong>共 {selectedCashflowCount} 条</strong>
        </div>
        <div className={styles.cashflowDialogList}>
          <DailyCashflowList
            expenses={selectedEntry.expenses}
            incomes={selectedEntry.incomes}
            onDeleteExpense={(record) => requestDelete(record, '花销', record.category)}
          />
        </div>
      </Modal>
      <Modal
        open={deleteTarget !== null}
        title={`删除${deleteTarget?.kind ?? '记录'}？`}
        onClose={closeDeleteDialog}
        width={420}
        centered
      >
        <div className={styles.deleteDialogBody}>
          <p className={styles.deleteDescription}>
            “{deleteTarget?.title}”将被永久删除，此操作无法撤销。
          </p>
          {deleteError && <Message tone="error">{deleteError}</Message>}
          <div className={styles.deleteDialogActions}>
            <Button type="button" variant="outline" onClick={closeDeleteDialog} disabled={isDeleting} autoFocus>
              取消
            </Button>
            <Button type="button" variant="danger" onClick={() => void confirmDelete()} disabled={isDeleting}>
              {isDeleting ? '正在删除…' : `删除${deleteTarget?.kind ?? '记录'}`}
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
};

export default CalendarView;
