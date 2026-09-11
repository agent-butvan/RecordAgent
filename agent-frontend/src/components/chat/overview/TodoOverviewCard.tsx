import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DotsThree } from '@phosphor-icons/react';
import { fetchDailyDay, setDailyTodoCompleted } from '../../../services/dailyEvents';
import { DailyTodoList } from '../../calendar/DailyTodoList';
import type { CalendarTodo } from '../../../types/calendar';
import type { TodoDailyEvent } from '../../../types/dailyEvent';
import { overviewTodos } from './overviewData';
import { useOverviewResource } from './useOverviewResource';
import styles from './SessionOverview.module.css';

export interface TodoTilesProps {
  date: string;
  refreshKey: number;
  onOpenCalendar: () => void;
  onCompose?: (prompt: string) => void;
}

export interface TodoSummaryTileProps {
  date?: string;
  refreshKey?: number;
  onOpenCalendar: () => void;
  todos?: TodoDailyEvent[];
  loading?: boolean;
  error?: string | null;
  onReload?: () => void;
}

export interface TodoListTileProps {
  date?: string;
  refreshKey?: number;
  onCompose?: (prompt: string) => void;
  todos?: CalendarTodo[];
  loading?: boolean;
  error?: string | null;
  saveError?: string | null;
  pendingIds?: ReadonlySet<string>;
  onToggle?: (id: string) => void;
  onReload?: () => void;
}

export function TodoSummaryTile({
  date,
  refreshKey,
  onOpenCalendar,
  todos: controlledTodos,
  loading: controlledLoading,
  error: controlledError,
  onReload: controlledReload,
}: TodoSummaryTileProps) {
  const isControlled = controlledTodos !== undefined;
  const load = useCallback(() => fetchDailyDay(new Date(`${date ?? ''}T12:00:00`)), [date]);
  const resource = useOverviewResource(load, isControlled ? 0 : (refreshKey ?? 0));

  const loading = isControlled ? (controlledLoading ?? false) : resource.loading;
  const error = isControlled ? (controlledError ?? null) : resource.error;
  const reload = isControlled ? (controlledReload ?? (() => {})) : resource.reload;
  const todos = isControlled ? controlledTodos : (resource.data ? overviewTodos(resource.data) : []);

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

export function TodoListTile({
  date,
  refreshKey,
  todos: controlledTodos,
  loading: controlledLoading,
  error: controlledError,
  saveError: controlledSaveError,
  pendingIds: controlledPendingIds,
  onToggle: controlledToggle,
  onReload: controlledReload,
}: TodoListTileProps) {
  const isControlled = controlledTodos !== undefined;
  const load = useCallback(() => fetchDailyDay(new Date(`${date ?? ''}T12:00:00`)), [date]);
  const resource = useOverviewResource(load, isControlled ? 0 : (refreshKey ?? 0));
  const fallbackPending = useRef(new Set<string>());
  const [fallbackPendingIds, setFallbackPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [fallbackSaveError, setFallbackSaveError] = useState<string | null>(null);

  const loading = isControlled ? (controlledLoading ?? false) : resource.loading;
  const error = isControlled ? (controlledError ?? null) : resource.error;
  const reload = isControlled ? (controlledReload ?? (() => {})) : resource.reload;
  const saveError = isControlled ? (controlledSaveError ?? null) : fallbackSaveError;
  const pendingIds = isControlled ? (controlledPendingIds ?? new Set()) : fallbackPendingIds;

  const internalCalendarTodos: CalendarTodo[] = useMemo(() => {
    if (isControlled) return [];
    if (!resource.data) return [];
    const todos = overviewTodos(resource.data);
    return todos.slice(0, 5).map((todo) => ({
      id: todo.id,
      title: todo.title,
      time: todo.details.time ?? undefined,
      priority: todo.details.priority,
      completed: todo.details.completed,
      recurrence: todo.details.recurrence,
      version: todo.version,
    }));
  }, [isControlled, resource.data]);

  const calendarTodos = isControlled ? (controlledTodos ?? []) : internalCalendarTodos;

  const fallbackToggle = async (id: string) => {
    const todo = calendarTodos.find((item) => item.id === id);
    if (!todo || fallbackPending.current.has(id)) return;
    fallbackPending.current.add(id);
    setFallbackPendingIds(new Set(fallbackPending.current));
    setFallbackSaveError(null);
    try {
      await setDailyTodoCompleted(id, !todo.completed, todo.version ?? 0, new Date(`${date ?? ''}T12:00:00`));
    } catch (cause) {
      setFallbackSaveError(cause instanceof Error ? cause.message : '待办更新失败');
    } finally {
      await reload();
      fallbackPending.current.delete(id);
      setFallbackPendingIds(new Set(fallbackPending.current));
    }
  };

  const handleToggle = isControlled ? (controlledToggle ?? (() => {})) : fallbackToggle;

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
          onToggle={handleToggle}
          compact
          pendingIds={pendingIds}
        />
      )}
    </section>
  );
}

/** 组合 DAILY TODO 汇总与 TODAY 清单，两张卡片共享唯一样本与乐观更新事务。 */
export function TodoOverviewCard({ date, refreshKey, onOpenCalendar, onCompose }: TodoTilesProps) {
  const load = useCallback(() => fetchDailyDay(new Date(`${date}T12:00:00`)), [date]);
  const { data, loading, error, reload } = useOverviewResource(load, refreshKey);
  const pending = useRef(new Set<string>());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [localOverrides, setLocalOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLocalOverrides({});
  }, [data]);

  const rawTodos = useMemo(() => (data ? overviewTodos(data) : []), [data]);

  const todos = useMemo(() => {
    if (!rawTodos.length) return [];
    if (Object.keys(localOverrides).length === 0) return rawTodos;
    return rawTodos.map((todo) => {
      if (todo.id in localOverrides) {
        return {
          ...todo,
          details: {
            ...todo.details,
            completed: localOverrides[todo.id],
          },
        };
      }
      return todo;
    });
  }, [rawTodos, localOverrides]);

  const calendarTodos: CalendarTodo[] = useMemo(() => {
    return todos.slice(0, 5).map((todo) => ({
      id: todo.id,
      title: todo.title,
      time: todo.details.time ?? undefined,
      priority: todo.details.priority,
      completed: todo.details.completed,
      recurrence: todo.details.recurrence,
      version: todo.version,
    }));
  }, [todos]);

  const toggle = async (id: string) => {
    const currentTodo = todos.find((item) => item.id === id);
    if (!currentTodo || pending.current.has(id)) return;
    const nextCompleted = !currentTodo.details.completed;

    // 1. 立即乐观更新本地状态，两张卡片毫秒级联动
    setLocalOverrides((prev) => ({ ...prev, [id]: nextCompleted }));
    pending.current.add(id);
    setPendingIds(new Set(pending.current));
    setSaveError(null);

    try {
      await setDailyTodoCompleted(id, nextCompleted, currentTodo.version ?? 0, new Date(`${date}T12:00:00`));
      await reload();
    } catch (cause) {
      // 2. 失败时回滚本地乐观覆盖
      setLocalOverrides((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setSaveError(cause instanceof Error ? cause.message : '待办更新失败');
    } finally {
      pending.current.delete(id);
      setPendingIds(new Set(pending.current));
    }
  };

  return (
    <>
      <TodoSummaryTile
        todos={todos}
        loading={loading}
        error={error}
        onReload={reload}
        onOpenCalendar={onOpenCalendar}
      />
      <TodoListTile
        todos={calendarTodos}
        loading={loading}
        error={error}
        saveError={saveError}
        pendingIds={pendingIds}
        onToggle={toggle}
        onReload={reload}
        onCompose={onCompose}
      />
    </>
  );
}


