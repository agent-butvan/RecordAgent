import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import type { CalendarExpense, CalendarIncome } from '../../types/calendar';
import { DailyRecordDeleteButton } from './DailyRecordDeleteButton';
import styles from './DailyCashflowList.module.css';

interface DailyCashflowListProps {
  expenses: CalendarExpense[];
  incomes: CalendarIncome[];
  maxItems?: number;
  onDeleteExpense: (expense: CalendarExpense) => void;
  onViewAll?: () => void;
}

/** 当日收支列表：统一承载右侧摘要和完整明细弹框中的流水行展示。 */
export const DailyCashflowList: React.FC<DailyCashflowListProps> = ({
  expenses,
  incomes,
  maxItems,
  onDeleteExpense,
  onViewAll,
}) => {
  const records = useMemo(() => [
    ...expenses.map((record) => ({ ...record, transactionType: 'expense' as const })),
    ...incomes.map((record) => ({ ...record, transactionType: 'income' as const })),
  ].sort((left, right) => left.time.localeCompare(right.time)), [expenses, incomes]);
  const visibleRecords = maxItems === undefined ? records : records.slice(0, maxItems);
  const hasMore = maxItems !== undefined && records.length > maxItems;

  return (
    <div className={styles.list}>
      {visibleRecords.map((record) => {
        const isExpense = record.transactionType === 'expense';
        return (
          <div key={`${record.transactionType}-${record.id}`} className={styles.item}>
            <span className={`${styles.icon} ${isExpense ? styles.expenseIconTone : styles.incomeIconTone}`}>
              {record.category.slice(0, 1)}
            </span>
            <span className={styles.body}>
              <strong>{record.category}</strong>
              <small>{record.note} · {record.time}</small>
            </span>
            <strong className={isExpense ? styles.expenseAmount : styles.incomeAmount}>
              {isExpense ? '-' : '+'}¥{record.amount.toFixed(2)}
            </strong>
            {isExpense && record.source !== 'finance' && (
              <DailyRecordDeleteButton
                label={`花销“${record.category}”`}
                onDelete={() => onDeleteExpense(record)}
              />
            )}
          </div>
        );
      })}
      {hasMore && onViewAll && (
        <button
          type="button"
          className={styles.viewAllButton}
          onClick={onViewAll}
          aria-label={`查看当日全部 ${records.length} 条收支明细`}
        >
          <span>查看全部</span>
          <ChevronRight size={13} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
