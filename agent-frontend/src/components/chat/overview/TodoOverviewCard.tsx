import { useCallback, useMemo, useRef, useState } from 'react';
import { DotsThree } from '@phosphor-icons/react';
import { fetchDailyDay, setDailyTodoCompleted } from '../../../services/dailyEvents';
import { DailyTodoList } from '../../calendar/DailyTodoList';
import type { CalendarTodo } from '../../../types/calendar';
import { overviewTodos } from './overviewData';
import { useOverviewResource } from './useOverviewResource';
import styles from './SessionOverview.module.css';

export interface TodoTilesProps {
  date: string;
  refreshKey: number;
  onOpenCalendar: () => void;
  onCompose?: (prompt: string) => void;
}

export function TodoSummaryTile({ date, refreshKey, onOpenCalendar }: Omit<TodoTilesProps, 'onCompose'>) {
  const load = useCallback(() => fetchDailyDay(new Date(`${date}T12:00:00`)), [date]);
  const { data, loading, error, reload } = useOverviewResource(load, refreshKey);
  const todos = data ? overviewTodos(data) : [];
  const completed = todos.filter((todo) => todo.details.completed).length;
  const remaining = todos.length - completed;
  const completion = todos.length ? Math.round((completed / todos.length) * 100) : 0;

  return (
    <section className={`${styles.tile} ${styles.todo}`}>
      <div className={styles.tileHead}>
        <div>
          <div className={styles.eyebrow}>DAILY TODO</div>
          <div className={styles.title}>今日待办</div>
        </div>
        <button type="button" className={styles.more} onClick={onOpenCalendar} title="查看日历" aria-label="查看日历">
          <DotsThree size={18} weight="bold" />
        </button>
      </div>
      {loading ? (
        <p className={styles.empty}>正在加载待办…</p>
      ) : error ? (
        <p className={styles.error} onClick={() => void reload()}>{error}</p>
      ) : (
        <>
          <div className={styles.bigNumber}>
            {remaining} <small>/ {todos.length} 待完成</small>
          </div>
          <div className={styles.progress}>
            <span className={styles.progressBar} style={{ width: `${completion}%` }} />
          </div>
          <div className={styles.progressLabel}>
            <span>已完成 {completed} 项</span>
            <span>{completion}%</span>
          </div>
        </>
      )}
    </section>
  );
}

export function TodoListTile({ date, refreshKey }: Pick<TodoTilesProps, 'date' | 'refreshKey' | 'onCompose'>) {
  const load = useCallback(() => fetchDailyDay(new Date(`${date}T12:00:00`)), [date]);
  const { data, loading, error, reload } = useOverviewResource(load, refreshKey);
  const pending = useRef(new Set<string>());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);

  const calendarTodos: CalendarTodo[] = useMemo(() => {
    if (!data) return [];
    const todos = overviewTodos(data);
    return todos.slice(0, 5).map((todo) => ({
      id: todo.id,
      title: todo.title,
      time: todo.details.time ?? undefined,
      priority: todo.details.priority,
      completed: todo.details.completed,
      recurrence: todo.details.recurrence,
      version: todo.version,
    }));
  }, [data]);

  const toggle = async (id: string) => {
    const todo = calendarTodos.find((item) => item.id === id);
    if (!todo || pending.current.has(id)) return;
    pending.current.add(id);
    setPendingIds(new Set(pending.current));
    setSaveError(null);
    try {
      await setDailyTodoCompleted(id, !todo.completed, todo.version ?? 0, new Date(`${date}T12:00:00`));
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : '待办更新失败');
    } finally {
      await reload();
      pending.current.delete(id);
      setPendingIds(new Set(pending.current));
    }
  };

  return (
    <section className={`${styles.tile} ${styles.todoList}`}>
      <div className={styles.tileHead}>
        <div>
          <div className={styles.eyebrow}>TODAY</div>
          <div className={styles.title}>接下来要做</div>
        </div>
        <span className={`${styles.pill} ${styles.pillBlue}`}>按优先级</span>
      </div>

      {saveError && <p className={styles.error} role="alert">{saveError}</p>}
      {loading ? (
        <p className={styles.empty}>正在加载待办列表…</p>
      ) : error ? (
        <p className={styles.error} onClick={() => void reload()}>{error}</p>
      ) : calendarTodos.length === 0 ? (
        <p className={styles.empty}>今天暂无待办事项。</p>
      ) : (
        <DailyTodoList
          todos={calendarTodos}
          onToggle={toggle}
          compact
          pendingIds={pendingIds}
        />
      )}
    </section>
  );
}

export function TodoOverviewCard(props: TodoTilesProps) {
  return (
    <>
      <TodoSummaryTile date={props.date} refreshKey={props.refreshKey} onOpenCalendar={props.onOpenCalendar} />
      <TodoListTile date={props.date} refreshKey={props.refreshKey} onCompose={props.onCompose} />
    </>
  );
}

