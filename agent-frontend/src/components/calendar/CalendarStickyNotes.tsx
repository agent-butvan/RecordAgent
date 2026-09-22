import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fetchRecurringTodos, setDailyTodoCompleted } from '../../services/dailyEvents';
import type { RecurringTodoSummary } from '../../types/dailyEvent';
import { useMessage } from '../common/Message';
import { StickyTodoNote, type StickyTodoItem } from './StickyTodoNote';
import styles from './CalendarStickyNotes.module.css';

interface CalendarStickyNotesProps {
  focusDate: Date;
  revision: number;
  onChanged: () => Promise<void>;
}

interface BoardSize {
  width: number;
  height: number;
}

function asStickyItems(todos: RecurringTodoSummary[], pendingIds: Set<string>): StickyTodoItem[] {
  return todos.map((todo) => ({
    id: todo.id,
    text: todo.title,
    done: todo.completed,
    pending: pendingIds.has(todo.id),
  }));
}

/** 读取真实周期待办，并在整个日历工作区内提供可拖拽便签。 */
export function CalendarStickyNotes({ focusDate, revision, onChanged }: CalendarStickyNotesProps) {
  const { showMessage } = useMessage();
  const boardRef = useRef<HTMLDivElement>(null);
  const [todos, setTodos] = useState<RecurringTodoSummary[]>([]);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [boardSize, setBoardSize] = useState<BoardSize | null>(null);
  const [expandedNote, setExpandedNote] = useState<'weekly' | 'monthly' | null>(null);

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const measure = () => setBoardSize({ width: board.clientWidth, height: board.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    measure();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    fetchRecurringTodos(focusDate)
      .then((items) => { if (active) setTodos(items); })
      .catch((error: unknown) => {
        if (active) showMessage('error', error instanceof Error ? error.message : '读取周期待办失败');
      });
    return () => { active = false; };
  }, [focusDate, revision, showMessage]);

  useEffect(() => setExpandedNote(null), [focusDate]);

  const weekly = useMemo(() => todos.filter((todo) => todo.recurrence === 'weekly'), [todos]);
  const monthly = useMemo(() => todos.filter((todo) => todo.recurrence === 'monthly'), [todos]);

  const toggle = async (item: StickyTodoItem) => {
    const todo = todos.find((candidate) => candidate.id === item.id);
    if (!todo || pendingIds.has(todo.id)) return;
    setPendingIds((current) => new Set(current).add(todo.id));
    try {
      const updated = await setDailyTodoCompleted(
        todo.id,
        !todo.completed,
        todo.version,
        new Date(`${todo.occurrenceDate}T00:00:00`),
      );
      setTodos((current) => current.map((candidate) => candidate.id === todo.id
        ? { ...candidate, completed: !todo.completed, version: updated.version }
        : candidate));
      try {
        await onChanged();
      } catch (error: unknown) {
        showMessage('error', error instanceof Error
          ? `待办已更新，但日历刷新失败：${error.message}`
          : '待办已更新，但日历刷新失败');
      }
    } catch (error: unknown) {
      showMessage('error', error instanceof Error ? error.message : '修改周期待办失败');
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(todo.id);
        return next;
      });
    }
  };

  const noteCount = Number(weekly.length > 0) + Number(monthly.length > 0);
  const layout = boardSize ? (() => {
    const noteWidth = 188;
    const noteHeight = 62;
    const gap = 10;
    const bottom = 24;
    const startY = Math.max(16, boardSize.height - noteCount * noteHeight - (noteCount - 1) * gap - bottom);
    return {
      x: Math.max(16, boardSize.width - noteWidth - 24),
      firstY: startY,
      secondY: startY + noteHeight + gap,
    };
  })() : null;

  return (
    <section className={styles.board} ref={boardRef} aria-label="待办便签">
      {layout && weekly.length > 0 && <StickyTodoNote
        title="本周待办"
        subtitle="Week Focus"
        tone="yellow"
        items={asStickyItems(weekly, pendingIds)}
        initialX={layout.x}
        initialY={layout.firstY}
        rotation={-2.4}
        collapsed={expandedNote !== 'weekly'}
        constraintsRef={boardRef}
        onCollapsedChange={(collapsed) => setExpandedNote(collapsed ? null : 'weekly')}
        onToggle={(item) => { void toggle(item); }}
      />}
      {layout && monthly.length > 0 && <StickyTodoNote
        title="本月待办"
        subtitle="Month Goals"
        tone="green"
        items={asStickyItems(monthly, pendingIds)}
        initialX={layout.x}
        initialY={weekly.length > 0 ? layout.secondY : layout.firstY}
        rotation={2.1}
        collapsed={expandedNote !== 'monthly'}
        constraintsRef={boardRef}
        onCollapsedChange={(collapsed) => setExpandedNote(collapsed ? null : 'monthly')}
        onToggle={(item) => { void toggle(item); }}
      />}
    </section>
  );
}
