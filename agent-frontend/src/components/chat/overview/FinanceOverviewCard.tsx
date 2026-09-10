import { useCallback, useState } from 'react';
import { fetchFinanceOverview, fetchFinanceExpenseChart } from '../../../services/financeApi';
import { OverviewCard } from '../../common/OverviewCard';
import { Button } from '../../common/Button';
import { Modal } from '../../common/Modal';
import type { FinanceTransaction } from '../../../types/finance';
import { useOverviewResource } from './useOverviewResource';
import styles from './SessionOverview.module.css';

interface FinanceOverviewCardProps {
  date: string;
  refreshKey: number;
  onOpenFinance: () => void;
  onCreate: () => void;
}

const money = (value: number, currency = 'CNY') => new Intl.NumberFormat('zh-CN', { style: 'currency', currency }).format(value);

/** 今日金额使用完整每日汇总，不能从接口截断的最近流水列表推算。 */
export function FinanceOverviewCard({ date, refreshKey, onOpenFinance, onCreate }: FinanceOverviewCardProps) {
  const load = useCallback(async () => {
    const [overview, chart] = await Promise.all([fetchFinanceOverview(), fetchFinanceExpenseChart('month')]);
    return { overview, chart };
  }, []);
  const { data, loading, error, reload } = useOverviewResource(load, `${date}:${refreshKey}`);
  const [selected, setSelected] = useState<FinanceTransaction | null>(null);
  const today = data?.chart.days.find((day) => day.date === date);
  const trend = data?.chart.days.slice(-7) ?? [];
  const trendMaximum = Math.max(1, ...trend.flatMap((day) => [day.total, day.income]));
  const trendPoints = (field: 'total' | 'income') => trend.map((day, index) => {
    const x = trend.length === 1 ? 50 : index / (trend.length - 1) * 100;
    const y = 42 - day[field] / trendMaximum * 36;
    return `${x},${y}`;
  }).join(' ');
  return <>
    <OverviewCard className={styles.financeSummary} title="今日花销" description="近七日收支趋势" loading={loading} error={error} onRetry={() => void reload()}
      action={<Button type="button" size="sm" variant="ghost" onClick={onCreate}>记一笔</Button>}>
      {data && <>
        <div className={styles.metric}><strong>{money(today?.total ?? 0)}</strong><span>今日支出</span></div>
        <div className={styles.financeTrend}>
          {trend.length > 0 ? <>
            <svg viewBox="0 0 100 44" preserveAspectRatio="none" role="img" aria-label="近七日收入与支出趋势">
              <title>近七日收入与支出趋势</title>
              <line x1="0" y1="42" x2="100" y2="42" />
              <polyline className={styles.expenseLine} points={trendPoints('total')} />
              <polyline className={styles.incomeLine} points={trendPoints('income')} />
            </svg>
            <div className={styles.trendLabels}>{trend.map((day) => <span key={day.date}>{Number(day.date.slice(5, 7))}/{Number(day.date.slice(8))}</span>)}</div>
          </> : <p className={styles.empty}>还没有可展示的收支趋势。</p>}
        </div>
        <dl className={styles.stats}>
          <div><dt>本月支出</dt><dd>{money(data.overview.monthExpense)}</dd></div>
          <div><dt>本月收入</dt><dd>{money(data.overview.monthIncome)}</dd></div>
          <div><dt>本月收益</dt><dd>{money(data.overview.monthYield)}</dd></div>
        </dl>
      </>}
    </OverviewCard>

    <OverviewCard className={styles.financeRecent} title="最近流水" loading={loading} error={error} onRetry={() => void reload()}
      action={<Button type="button" size="sm" variant="ghost" onClick={onOpenFinance}>查看全部</Button>}>
      {data && (data.overview.transactions.length === 0 ? <p className={styles.empty}>还没有流水。从「记一笔」开始，留下今天的收支。</p>
          : <ul className={styles.rows}>{data.overview.transactions.slice(0, 3).map((item) => <li key={item.id}>
            <button type="button" className={styles.row} onClick={() => setSelected(item)}>
              <span className={styles.rowContent}><span className={styles.rowTitle}>{item.note || item.category}</span><small>{item.accountName} · {item.date.slice(5)} {item.time}</small></span>
              <span className={`${styles.amount} ${item.transactionType === 'expense' ? styles.expense : styles.income}`}>{item.transactionType === 'expense' ? '−' : '+'}{money(item.amount, item.currency)}</span>
            </button>
          </li>)}</ul>)}
    </OverviewCard>
    <Modal open={selected !== null} title="流水详情" onClose={() => setSelected(null)} centered width={480}>
      {selected && <><div className={styles.metric}><strong>{selected.transactionType === 'expense' ? '−' : '+'}{money(selected.amount, selected.currency)}</strong><span>{selected.transactionType === 'expense' ? '支出' : selected.transactionType === 'yield' ? '收益' : '收入'}</span></div>
        <p>{selected.note || selected.category}</p><dl className={styles.stats}><div><dt>账户</dt><dd>{selected.accountName}</dd></div><div><dt>分类</dt><dd>{selected.category}</dd></div><div><dt>发生时间</dt><dd>{selected.date} {selected.time}</dd></div></dl></>}
    </Modal>
  </>;
}
