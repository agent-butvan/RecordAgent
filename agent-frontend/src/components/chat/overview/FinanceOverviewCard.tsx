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
  return <>
    <OverviewCard title="收支一览" description="今日花销与本月收支" loading={loading} error={error} onRetry={() => void reload()}
      action={<Button type="button" size="sm" variant="ghost" onClick={onCreate}>记一笔</Button>}
      footer={<><span className={styles.muted}>最近流水</span><Button type="button" size="sm" variant="ghost" onClick={onOpenFinance}>全部财务</Button></>}>
      {data && <>
        <div className={styles.metric}><strong>{money(today?.total ?? 0)}</strong><span>今日支出</span></div>
        <dl className={styles.stats}>
          <div><dt>本月支出</dt><dd>{money(data.overview.monthExpense)}</dd></div>
          <div><dt>本月收入</dt><dd>{money(data.overview.monthIncome)}</dd></div>
          <div><dt>本月收益</dt><dd>{money(data.overview.monthYield)}</dd></div>
        </dl>
        {data.overview.transactions.length === 0 ? <p className={styles.empty}>还没有流水。从「记一笔」开始，留下今天的收支。</p>
          : <ul className={styles.rows}>{data.overview.transactions.slice(0, 3).map((item) => <li key={item.id}>
            <button type="button" className={styles.row} onClick={() => setSelected(item)}>
              <span className={styles.rowContent}><span className={styles.rowTitle}>{item.note || item.category}</span><small>{item.accountName} · {item.date.slice(5)} {item.time}</small></span>
              <span className={`${styles.amount} ${item.transactionType === 'expense' ? styles.expense : styles.income}`}>{item.transactionType === 'expense' ? '−' : '+'}{money(item.amount, item.currency)}</span>
            </button>
          </li>)}</ul>}
      </>}
    </OverviewCard>
    <Modal open={selected !== null} title="流水详情" onClose={() => setSelected(null)} centered width={480}>
      {selected && <><div className={styles.metric}><strong>{selected.transactionType === 'expense' ? '−' : '+'}{money(selected.amount, selected.currency)}</strong><span>{selected.transactionType === 'expense' ? '支出' : selected.transactionType === 'yield' ? '收益' : '收入'}</span></div>
        <p>{selected.note || selected.category}</p><dl className={styles.stats}><div><dt>账户</dt><dd>{selected.accountName}</dd></div><div><dt>分类</dt><dd>{selected.category}</dd></div><div><dt>发生时间</dt><dd>{selected.date} {selected.time}</dd></div></dl></>}
    </Modal>
  </>;
}
