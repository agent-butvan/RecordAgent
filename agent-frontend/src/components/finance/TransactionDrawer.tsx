import React, { useMemo, useState } from 'react';
import { CalendarDays, Search, WalletCards } from 'lucide-react';
import type { FinanceTransaction } from '../../types/finance';
import { Drawer } from '../common/Drawer';
import { TransactionTypeIcon } from './TransactionTypeIcon';
import styles from './TransactionDrawer.module.css';

interface TransactionDrawerProps {
  open: boolean;
  transactions: FinanceTransaction[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
}

const money = (value: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);

/** 全部流水抽屉：按日期和说明筛选，并完整展示流水来源与账户信息。 */
export const TransactionDrawer: React.FC<TransactionDrawerProps> = ({
  open, transactions, loading, error, onClose, onRetry,
}) => {
  const [date, setDate] = useState('');
  const [keyword, setKeyword] = useState('');
  const filtered = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase('zh-CN');
    return transactions.filter((transaction) => (
      (!date || transaction.date === date)
      && (!normalizedKeyword || transaction.note.toLocaleLowerCase('zh-CN').includes(normalizedKeyword))
    ));
  }, [date, keyword, transactions]);

  return <Drawer
    open={open}
    title="全部流水"
    description={loading ? '正在读取流水…' : `共 ${transactions.length} 笔，当前显示 ${filtered.length} 笔`}
    onClose={onClose}
  >
    <div className={styles.filters} role="search" aria-label="筛选流水">
      <label><span>日期</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <label className={styles.searchField}><span>说明</span><div><Search size={14} aria-hidden="true" /><input type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索说明" /></div></label>
      {(date || keyword) && <button type="button" className={styles.clearButton} onClick={() => { setDate(''); setKeyword(''); }}>清除筛选</button>}
    </div>

    <div className={styles.list} aria-live="polite">
      {loading ? <div className={styles.state}>正在读取全部流水…</div>
        : error ? <div className={styles.state}><strong>流水加载失败</strong><p>{error}</p><button type="button" onClick={onRetry}>重新加载</button></div>
          : filtered.length ? filtered.map((transaction) => {
            const isExpense = transaction.transactionType === 'expense';
            return <article className={styles.row} key={transaction.id}>
              <TransactionTypeIcon type={transaction.transactionType} category={transaction.category} />
              <div className={styles.content}>
                <div className={styles.primary}><strong>{transaction.note}</strong><b className={isExpense ? styles.expenseAmount : styles.incomeAmount}>{isExpense ? '-' : '+'}{money(transaction.amount)}</b></div>
                <div className={styles.meta}>
                  <span><CalendarDays size={12} />{transaction.date} {transaction.time.slice(0, 5)}</span>
                  <span><WalletCards size={12} />{transaction.accountName}</span>
                  <span>{transaction.category}</span>
                  <span>{transaction.source === 'calendar' ? '日历记录' : transaction.source === 'automatic' ? '自动收益' : '手工记录'}</span>
                </div>
              </div>
            </article>;
          }) : <div className={styles.state}><strong>没有匹配的流水</strong><p>请调整日期或说明关键词。</p></div>}
    </div>
  </Drawer>;
};
