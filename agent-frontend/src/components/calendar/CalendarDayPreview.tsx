import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { fetchCalendarDetails } from '../../services/calendarDetails';
import { toCalendarDayEntry } from './dailyEventViewModel';
import type {
  FinanceTransaction,
  FinanceTransactionType,
} from '../../types/finance';
import { formatStudyDuration } from './calendarPresentation';
import { useStudyRealtime } from '../../context/studyRealtimeState';
import styles from './CalendarDayPreview.module.css';

interface CalendarDayPreviewProps {
  date: Date;
  id: string;
  anchor: HTMLElement;
  onEnter: () => void;
  onLeave: () => void;
  onClose: () => void;
}
const LABELS: Record<FinanceTransactionType, string> = {
  income: '收入',
  expense: '支出',
  yield: '收益',
  transfer_in: '转入',
  transfer_out: '转出',
  adjustment_increase: '校准增加',
  adjustment_decrease: '校准减少',
};
const decreases = new Set<FinanceTransactionType>([
  'expense',
  'transfer_out',
  'adjustment_decrease',
]);
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h4>{title}</h4>
      {children}
    </section>
  );
}
function Row({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className={styles.row}>
      <span>{title}</span>
      <small>{meta}</small>
    </div>
  );
}
/** 按日加载的可移入预览；所有列表完整展示，长内容在面板内滚动。 */
export function CalendarDayPreview({
  date,
  id,
  anchor,
  onEnter,
  onLeave,
  onClose,
}: CalendarDayPreviewProps) {
  const { syncGeneration } = useStudyRealtime();
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [data, setData] = useState<Awaited<
    ReturnType<typeof fetchCalendarDetails>
  > | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    void fetchCalendarDetails(date).then((result) => {
      if (active) setData(result);
    });
    return () => {
      active = false;
    };
  }, [date, retry, syncGeneration]);
  useLayoutEffect(() => {
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const height = panel.current?.offsetHeight ?? 400;
      const width = panel.current?.offsetWidth ?? 400;
      setPosition({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top: Math.max(
          12,
          rect.bottom + height + 10 <= window.innerHeight
            ? rect.bottom + 6
            : rect.top - height - 6,
        ),
      });
    };
    place();
    const observer = new ResizeObserver(place);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor]);
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, [onClose]);
  const entry =
    data?.daily.status === 'fulfilled'
      ? toCalendarDayEntry(data.daily.value)
      : null;
  const failed =
    data && Object.values(data).some((result) => result.status === 'rejected');
  const assets = data?.assets.status === 'fulfilled' ? data.assets.value : [];
  const groups = new Map<string, FinanceTransaction[]>();
  for (const item of assets)
    groups.set(item.accountId, [...(groups.get(item.accountId) ?? []), item]);
  return createPortal(
    <div
      ref={panel}
      id={id}
      role="region"
      aria-label="每日详情"
      tabIndex={0}
      className={styles.preview}
      style={position}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onLeave();
      }}
    >
      <header className={styles.heading}>
        <div>
          <strong>
            {date.getMonth() + 1}月{date.getDate()}日 · 星期
            {'日一二三四五六'[date.getDay()]}
          </strong>
          <small>每日详情 · 移入查看，移出收起</small>
        </div>
        <button type="button" onClick={onClose} aria-label="关闭每日详情">
          ×
        </button>
      </header>
      {!data ? (
        <p className={styles.empty}>正在读取当天记录…</p>
      ) : (
        <>
          {failed && (
            <p className={styles.error}>
              部分数据读取失败{' '}
              <button
                type="button"
                onClick={() => setRetry((value) => value + 1)}
              >
                重试
              </button>
            </p>
          )}
          {entry && (
            <>
              <div className={styles.summary}>
                <span>
                  支出{' '}
                  <b>
                    ¥
                    {entry.expenses
                      .reduce((n, item) => n + item.amount, 0)
                      .toFixed(2)}
                  </b>
                </span>
                <span>
                  收入{' '}
                  <b>
                    ¥
                    {entry.incomes
                      .reduce((n, item) => n + item.amount, 0)
                      .toFixed(2)}
                  </b>
                </span>
              </div>
              <Section
                title={`待办 · ${entry.todos.filter((item) => item.completed).length}/${entry.todos.length} 已完成`}
              >
                {entry.todos.length ? (
                  entry.todos.map((item) => (
                    <Row
                      key={item.id}
                      title={`${item.completed ? '✓' : '○'} ${item.title}`}
                      meta={item.time}
                    />
                  ))
                ) : (
                  <p className={styles.empty}>暂无待办</p>
                )}
              </Section>
              {entry.schedules.length > 0 && (
                <Section title="日程">
                  {entry.schedules.map((item) => (
                    <Row
                      key={item.id}
                      title={item.title}
                      meta={[item.startTime, item.endTime]
                        .filter(Boolean)
                        .join(' – ')}
                    />
                  ))}
                </Section>
              )}
              <Section title="收支明细">
                {[
                  ...entry.expenses.map((item) => ({ ...item, sign: '−' })),
                  ...entry.incomes.map((item) => ({ ...item, sign: '+' })),
                ].map((item) => (
                  <Row
                    key={item.id}
                    title={`${item.category} · ${item.note || '无备注'}`}
                    meta={`${item.sign}¥${item.amount.toFixed(2)} · ${item.time}`}
                  />
                ))}
                {!entry.expenses.length && !entry.incomes.length && (
                  <p className={styles.empty}>暂无收支</p>
                )}
              </Section>
            </>
          )}
          {data.assets.status === 'fulfilled' && (
            <Section title="资产变动 · 仅显示当天有流水的账户">
              {groups.size ? (
                [...groups].map(([accountId, items]) => (
                  <div key={accountId} className={styles.asset}>
                    <strong>{items[0].accountName}</strong>
                    {items.map((item) => (
                      <Row
                        key={item.id}
                        title={`${LABELS[item.transactionType]} · ${item.note || item.category}`}
                        meta={`${decreases.has(item.transactionType) ? '−' : '+'}${item.amount.toFixed(2)} ${item.currency}`}
                      />
                    ))}
                  </div>
                ))
              ) : (
                <p className={styles.empty}>当天没有资产变动</p>
              )}
            </Section>
          )}
          <Section
            title={`学习时间${data.study.status === 'fulfilled' ? ` · ${formatStudyDuration(data.study.value.totalDurationSeconds)}` : ' · 暂不可用'}`}
          >
            {data.sessions.status === 'fulfilled' &&
              (data.sessions.value.length ? (
                data.sessions.value.map((item) => (
                  <Row
                    key={item.id}
                    title={item.content}
                    meta={`${new Date(item.startedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} – ${item.endedAt ? new Date(item.endedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '进行中'}`}
                  />
                ))
              ) : (
                <p className={styles.empty}>暂无学习记录</p>
              ))}
          </Section>
          {data.records.status === 'fulfilled' && (
            <Section title={`当天资料 · ${data.records.value.length} 篇`}>
              {data.records.value.length ? (
                data.records.value.map((item) => (
                  <div className={styles.document} key={item.id}>
                    <strong>{item.title || '无标题资料'}</strong>
                    <p>
                      {item.contentText.slice(0, 140) || '暂无正文'}
                      {item.contentText.length > 140 ? '…' : ''}
                    </p>
                  </div>
                ))
              ) : (
                <p className={styles.empty}>暂无资料</p>
              )}
            </Section>
          )}
          {entry?.journals?.some((item) => item.source !== 'record') && (
            <Section title="手记">
              {entry.journals
                .filter((item) => item.source !== 'record')
                .map((item) => (
                  <Row
                    key={item.id}
                    title={item.title || item.excerpt.slice(0, 100)}
                    meta={item.mood}
                  />
                ))}
            </Section>
          )}
        </>
      )}
    </div>,
    document.body,
  );
}
