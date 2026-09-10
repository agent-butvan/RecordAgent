import { useCallback, useRef, useState } from 'react';
import { DotsThree } from '@phosphor-icons/react';
import { fetchDailyDay, setDailyTodoCompleted } from '../../../services/dailyEvents';
import { overviewTodos } from './overviewData';
import { useOverviewResource } from './useOverviewResource';
import styles from './SessionOverview.module.css';

const recurrenceLabels = {
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
} as const;

export interface TodoTilesProps {
  date: string;
  refreshKey: number;
  onOpenCalendar: () => void;
  onCompose: (prompt: string) => void;
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

export function TodoListTile({ date, refreshKey, onCompose }: Pick<TodoTilesProps, 'date' | 'refreshKey' | 'onCompose'>) {
  const load = useCallback(() => fetchDailyDay(new Date(`${date}T12:00:00`)), [date]);
  const { data, loading, error, reload } = useOverviewResource(load, refreshKey);
  const pending = useRef(new Set<string>());
  const [, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const todos = data ? overviewTodos(data) : [];

  const toggle = async (id: string) => {
    const todo = todos.find((item) => item.id === id);
    if (!todo || pending.current.has(id)) return;
    pending.current.add(id);
    setPendingIds(new Set(pending.current));
    setSaveError(null);
    try {
      await setDailyTodoCompleted(id, !todo.details.completed, todo.version, new Date(`${date}T12:00:00`));
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : '待办更新失败');
    } finally {
      await reload();
      pending.current.delete(id);
      setPendingIds(new Set(pending.current));
    }
  };

  const planPrompt = '根据剩余时间，帮我重新安排今天的待办顺序。';

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
      ) : todos.length === 0 ? (
        <p className={styles.empty}>今天暂无待办事项。</p>
      ) : (
        <div className={styles.todoItems}>
          {todos.slice(0, 5).map((todo) => {
            const isDone = todo.details.completed;
            const recurrenceText = todo.details.recurrence && todo.details.recurrence !== 'none'
              ? recurrenceLabels[todo.details.recurrence]
              : '每天';
            return (
              <div key={todo.id} className={styles.todoRow}>
                <div
                  className={`${styles.check} ${isDone ? styles.done : ''}`}
                  onClick={() => void toggle(todo.id)}
                  title={isDone ? '取消完成' : '完成待办'}
                  role="checkbox"
                  aria-checked={isDone}
                >
                  {isDone ? '✓' : ''}
                </div>
                <div>
                  <div className={isDone ? styles.todoNameDone : styles.todoName}>{todo.title}</div>
                  <div className={styles.todoSub}>
                    {isDone ? (todo.details.time ? `${todo.details.time} 已完成` : '今日已完成') : `计划 · ${recurrenceText}`}
                  </div>
                </div>
                {isDone ? (
                  <span className={styles.pill}>已完成</span>
                ) : todo.details.priority === 'high' ? (
                  <span className={`${styles.pill} ${styles.pillBlue}`}>优先</span>
                ) : (
                  <span className={styles.pill}>待完成</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.agentNote} onClick={() => onCompose(planPrompt)} title="点击直接咨询 Agent 重新规划待办">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 3v4M12 17v4M4.2 6.2l2.8 2.8M17 15l2.8 2.8M3 12h4M17 12h4M4.2 17.8 7 15M17 9l2.8-2.8" />
        </svg>
        <span>可以直接说：<b>“根据剩余时间，帮我重新安排今天的待办顺序。”</b></span>
      </div>
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
