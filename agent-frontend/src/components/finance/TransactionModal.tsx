import React, { useEffect, useState } from 'react';
import type { CreateFinanceTransactionInput, FinanceAccount } from '../../types/finance';
import { formatLocalDate } from '../../services/dailyEvents';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import styles from './TransactionModal.module.css';

const EXPENSE_CATEGORIES = ['餐饮', '交通', '购物', '居住', '娱乐', '学习', '医疗', '其他'];
const INCOME_CATEGORIES = ['工资', '奖金', '报销', '转入', '兼职', '其他'];

function nowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function money(value: number): string {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);
}

interface TransactionModalProps {
  open: boolean;
  accounts: FinanceAccount[];
  defaultDate?: string;
  onClose: () => void;
  onSubmit: (input: CreateFinanceTransactionInput) => Promise<void>;
}

/** 统一的收入 / 支出记账弹框，供财务页和日历页共用。 */
export const TransactionModal: React.FC<TransactionModalProps> = ({
  open, accounts, defaultDate, onClose, onSubmit,
}) => {
  const [entryType, setEntryType] = useState<'expense' | 'income'>('expense');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const categories = entryType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  useEffect(() => {
    if (!open) return;
    setEntryType('expense');
    setError(null);
  }, [open]);

  const closeModal = () => {
    if (isSaving) return;
    setError(null);
    onClose();
  };

  const submitTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setIsSaving(true);
    setError(null);
    try {
      await onSubmit({
        accountId: String(data.get('accountId')),
        transactionType: entryType,
        category: String(data.get('category')),
        note: String(data.get('note') ?? '').trim(),
        amount: Number(data.get('amount')),
        date: String(data.get('date')),
        time: String(data.get('time')),
      });
      form.reset();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '流水保存失败，请检查填写内容。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal open={open} title="记一笔" onClose={closeModal} width={600} centered>
      <form key={`${open}-${defaultDate ?? 'today'}`} className={styles.transactionForm} onSubmit={(event) => { void submitTransaction(event); }}>
        <div className={styles.typeSwitch} aria-label="流水类型">
          <button type="button" className={entryType === 'expense' ? styles.typeActive : ''} onClick={() => setEntryType('expense')}>支出</button>
          <button type="button" className={entryType === 'income' ? styles.typeActive : ''} onClick={() => setEntryType('income')}>收入</button>
        </div>
        {error && <div className={styles.modalError} role="alert">{error}</div>}
        <label className={styles.amountField}><span>金额</span><div><b>¥</b><input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required autoFocus /></div></label>
        <div className={styles.formGrid}>
          <label><span>资产账户</span><select name="accountId" required>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name} · {money(account.balance)}</option>)}</select></label>
          <label><span>分类</span><select name="category" key={entryType}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label className={styles.wideField}><span>说明</span><input name="note" required placeholder={entryType === 'expense' ? '例如：午餐' : '例如：九月工资'} /></label>
          <label><span>日期</span><input name="date" type="date" defaultValue={defaultDate ?? formatLocalDate(new Date())} required /></label>
          <label><span>时间</span><input name="time" type="time" defaultValue={nowTime()} required /></label>
        </div>
        <div className={styles.modalActions}><Button type="button" variant="outline" onClick={closeModal} disabled={isSaving}>取消</Button><Button type="submit" variant="primary" disabled={isSaving}>{isSaving ? '保存中…' : `保存${entryType === 'expense' ? '支出' : '收入'}`}</Button></div>
      </form>
    </Modal>
  );
};

export default TransactionModal;
