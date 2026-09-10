import { useCallback, useRef, useState } from 'react';
import { fetchDailyDay, setDailyTodoCompleted } from '../../../services/dailyEvents';
import { OverviewCard } from '../../common/OverviewCard';
import { Button } from '../../common/Button';
import { DailyTodoList } from '../../calendar/DailyTodoList';
import { overviewTodos } from './overviewData';
import { useOverviewResource } from './useOverviewResource';
import styles from './SessionOverview.module.css';

interface TodoOverviewCardProps {
  date: string;
  refreshKey: number;
  onOpenCalendar: () => void;
  onCompose: (prompt: string) => void;
}

/** 复用日历清单，按发生日期与版本提交循环待办的完成状态。 */
export function TodoOverviewCard({ date, refreshKey, onOpenCalendar, onCompose }: TodoOverviewCardProps) {
  const load = useCallback(() => fetchDailyDay(new Date(`${date}T12:00:00`)), [date]);
  const { data, loading, error, reload } = useOverviewResource(load, refreshKey);
  const pending = useRef(new Set<string>());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const todos = data ? overviewTodos(data) : [];
  const completed = todos.filter((todo) => todo.details.completed).length;
  const toggle = async (id: string) => {
    const todo = todos.find((item) => item.id === id);
    if (!todo || pending.current.has(id)) return;
    pending.current.add(id);
    setPendingIds(new Set(pending.current));
    setSaveError(null);
    try {
      await setDailyTodoCompleted(id, !todo.details.completed, todo.version, new Date(`${date}T12:00:00`));
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : '待办更新失败，请重试。');
    } finally {
      await reload();
      pending.current.delete(id);
      setPendingIds(new Set(pending.current));
    }
  };
  const plan = () => onCompose(`请根据以下今天（${date}）的未完成待办，帮我安排接下来的时间：\n${todos.filter((todo) => !todo.details.completed).map((todo) => `- ${todo.title}${todo.details.time ? `（${todo.details.time}）` : ''}`).join('\n')}`);
  return <OverviewCard title="今天要做" description="先完成一件，再开始下一件" loading={loading} error={error} onRetry={() => void reload()}
    action={<Button type="button" size="sm" variant="ghost" onClick={onOpenCalendar}>日历</Button>}
    footer={<><span className={styles.muted}>{todos.length > 3 ? `显示前 3 项，共 ${todos.length} 项` : `已完成 ${completed} 项`}</span><Button type="button" size="sm" variant="ghost" disabled={completed === todos.length} onClick={plan}>帮我安排今天</Button></>}>
    <div className={styles.metric}><strong>{todos.length - completed}</strong><span>项待完成 / 共 {todos.length} 项</span></div>
    {todos.length > 0 && <progress className={styles.progress} value={completed} max={todos.length} aria-label="今日待办完成进度" />}
    {saveError && <p className={styles.error} role="alert">{saveError}</p>}
    <div className={styles.cardDetails}>
      <DailyTodoList compact todos={todos.slice(0, 3).map((todo) => ({ id: todo.id, title: todo.title, version: todo.version, ...todo.details, time: todo.details.time ?? undefined }))}
        onToggle={(id) => void toggle(id)} pendingIds={pendingIds} />
    </div>
  </OverviewCard>;
}
