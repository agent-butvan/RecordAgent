import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowClockwiseIcon, ArrowsLeftRightIcon, CaretRightIcon, PlusIcon, SparkleIcon, WalletIcon } from '@phosphor-icons/react';
import { createFinanceAccount, createFinanceTransaction, createFinanceTransfer, fetchFinanceCategories, fetchFinanceExpenseChart, fetchFinanceOverview, fetchFinanceTransactions } from '../../services/financeApi';
import type { CreateFinanceTransactionInput, CreateFinanceTransferInput, FinanceAccountType, FinanceCategoryOptions, FinanceChartRange, FinanceExpenseChart, FinanceOverview, FinanceTransaction } from '../../types/finance';
import { Button } from '../common/Button';
import { useMessage } from '../common/Message';
import { Modal } from '../common/Modal';
import { TopBar } from '../common/TopBar';
import styles from './FinancePage.module.css';
import { AccountTypeIcon } from './AccountTypeIcon';
import { AssetAccountDeck } from './AssetAccountDeck';
import { SpendingTrendChart } from './SpendingTrendChart';
import { TransactionTypeIcon } from './TransactionTypeIcon';
import { TransactionDrawer } from './TransactionDrawer';
import { TransactionModal } from './TransactionModal';
import { TransferModal } from './TransferModal';
import { AssetDetailModal } from './AssetDetailModal';

const ACCOUNT_TYPES: Array<{ value: FinanceAccountType; label: string; interest: boolean }> = [
  { value: 'wechat_balance', label: '微信余额', interest: false },
  { value: 'wechat_yield', label: '微信零钱通', interest: true },
  { value: 'alipay_balance', label: '支付宝余额', interest: false },
  { value: 'alipay_yuebao', label: '支付宝余额宝', interest: true },
  { value: 'bank', label: '银行卡', interest: false },
  { value: 'other', label: '其他', interest: false },
];
function money(value: number): string {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);
}

/** 独立财务工作台：统一完成资产建档、收支记账和自动收益查看。 */
export const FinancePage: React.FC = () => {
  const { showMessage } = useMessage();
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<FinanceCategoryOptions>({ expense: [], income: [] });
  const [chart, setChart] = useState<FinanceExpenseChart | null>(null);
  const [chartRange, setChartRange] = useState<FinanceChartRange>('month');
  const [isLoading, setIsLoading] = useState(true);
  const [isChartLoading, setIsChartLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isTransactionDrawerOpen, setIsTransactionDrawerOpen] = useState(false);
  const [isAssetDetailModalOpen, setIsAssetDetailModalOpen] = useState(false);
  const [allTransactions, setAllTransactions] = useState<FinanceTransaction[]>([]);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [interestEnabled, setInterestEnabled] = useState(false);
  const [accountType, setAccountType] = useState<FinanceAccountType>('wechat_balance');
  const chartRequestId = useRef(0);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextOverview, nextCategories] = await Promise.all([fetchFinanceOverview(), fetchFinanceCategories()]);
      setOverview(nextOverview);
      setCategoryOptions(nextCategories);
    }
    catch (cause) { showMessage('error', cause instanceof Error ? cause.message : '财务数据加载失败，请稍后重试。'); }
    finally { setIsLoading(false); }
  }, [showMessage]);

  const loadChart = useCallback(async (range: FinanceChartRange) => {
    const requestId = ++chartRequestId.current;
    setIsChartLoading(true);
    setChartError(null);
    try {
      const nextChart = await fetchFinanceExpenseChart(range);
      if (requestId === chartRequestId.current) setChart(nextChart);
    } catch (cause) {
      if (requestId === chartRequestId.current) {
        setChartError(cause instanceof Error ? cause.message : '支出趋势加载失败，请稍后重试。');
      }
    } finally {
      if (requestId === chartRequestId.current) setIsChartLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadChart(chartRange); }, [chartRange, loadChart]);
  const isYieldAccountType = accountType === 'wechat_yield' || accountType === 'alipay_yuebao';
  const recentTransactions = overview?.transactions.slice(0, 5) ?? [];

  const loadAllTransactions = useCallback(async () => {
    setIsTransactionsLoading(true);
    setTransactionsError(null);
    try { setAllTransactions(await fetchFinanceTransactions()); }
    catch (cause) { setTransactionsError(cause instanceof Error ? cause.message : '全部流水加载失败，请稍后重试。'); }
    finally { setIsTransactionsLoading(false); }
  }, []);

  const openTransactionDrawer = () => {
    setIsTransactionDrawerOpen(true);
    void loadAllTransactions();
  };

  const openAccountModal = () => {
    setAccountError(null);
    setInterestEnabled(false);
    setAccountType('wechat_balance');
    setIsAccountModalOpen(true);
  };

  const closeAccountModal = () => {
    if (isSaving) return;
    setAccountError(null);
    setIsAccountModalOpen(false);
  };

  const openTransactionModal = () => {
    if (!overview?.accounts.length) return;
    setIsTransactionModalOpen(true);
  };

  const submitAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setIsSaving(true);
    setAccountError(null);
    try {
      await createFinanceAccount({
        name: String(data.get('name') ?? '').trim(),
        accountType: String(data.get('accountType')) as FinanceAccountType,
        currency: 'CNY', initialBalance: Number(data.get('initialBalance')), interestEnabled,
        annualRatePercent: interestEnabled ? Number(data.get('annualRatePercent')) : 0,
      });
      form.reset();
      setInterestEnabled(false);
      setIsAccountModalOpen(false);
      await load();
    } catch (cause) {
      setAccountError(cause instanceof Error ? cause.message : '账户保存失败，请检查填写内容。');
    } finally { setIsSaving(false); }
  };

  const submitTransaction = async (input: CreateFinanceTransactionInput) => {
    await createFinanceTransaction(input);
    setIsTransactionModalOpen(false);
    try {
      await Promise.all([load(), loadChart(chartRange), ...(isTransactionDrawerOpen ? [loadAllTransactions()] : [])]);
    } catch (cause) {
      showMessage('error', cause instanceof Error ? `流水已保存，但财务数据刷新失败：${cause.message}` : '流水已保存，但财务数据刷新失败');
    }
  };

  const submitTransfer = async (input: CreateFinanceTransferInput) => {
    await createFinanceTransfer(input);
    setIsTransferModalOpen(false);
    try {
      await Promise.all([load(), loadChart(chartRange), ...(isTransactionDrawerOpen ? [loadAllTransactions()] : [])]);
    } catch (cause) {
      showMessage('error', cause instanceof Error ? `划账已保存，但财务数据刷新失败：${cause.message}` : '划账已保存，但财务数据刷新失败');
    }
  };

  return <main className={styles.workspace}>
    <TopBar icon={<WalletIcon size={16} />} title="财务" subtitle="本地数据" actions={<>
      <button type="button" className={styles.iconButton} title="刷新财务数据" aria-label="刷新财务数据"
        onClick={() => void Promise.all([load(), loadChart(chartRange)])} disabled={isLoading || isChartLoading}>
        <ArrowClockwiseIcon size={14} className={isLoading || isChartLoading ? styles.spinning : ''} />
      </button>
      <Button type="button" variant="outline" size="sm" icon={<PlusIcon size={13} weight="bold" />} onClick={openAccountModal}>添加账户</Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        icon={<ArrowsLeftRightIcon size={13} weight="bold" />}
        onClick={() => setIsTransferModalOpen(true)}
        disabled={(overview?.accounts.length ?? 0) < 2}
        title={(overview?.accounts.length ?? 0) < 2 ? '至少需要两个资产账户才能划账' : '在账户之间划转资金'}
      >
        划账
      </Button>
      <Button type="button" variant="primary" size="sm" onClick={openTransactionModal} disabled={!overview?.accounts.length}>记一笔</Button>
    </>} />

    <div className={styles.page}><div className={styles.content}>
      {isLoading && !overview ? <div className={styles.loading}>正在读取财务数据…</div> : <>
        <section className={styles.overview} aria-label="本月财务概览">
          <div
            className={styles.balanceBlock}
            role="button"
            tabIndex={0}
            onClick={() => setIsAssetDetailModalOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsAssetDetailModalOpen(true);
              }
            }}
            title="点击查看全部资产概览"
            aria-label="总资产：点击查看全部资产详情概览"
          >
            <span>总资产</span>
            <strong>{money(overview?.totalAssets ?? 0)}</strong>
            <small>{overview?.accounts.length ?? 0} 个账户</small>
          </div>
          <dl className={styles.monthStats}>
            <div className={styles.incomeStat}><dt>本月收入</dt><dd>{money(overview?.monthIncome ?? 0)}</dd></div>
            <div className={styles.expenseStat}><dt>本月支出</dt><dd>{money(overview?.monthExpense ?? 0)}</dd></div>
            <div className={styles.yieldStat}><dt>理财收益</dt><dd>{money(overview?.monthYield ?? 0)}</dd></div>
          </dl>
        </section>

        <SpendingTrendChart chart={chart} range={chartRange} loading={isChartLoading} error={chartError}
          onRangeChange={setChartRange} />

        <div className={styles.financeLayout}>
          <section className={styles.historyPanel}>
            <div className={styles.sectionHeading}><h2>最近流水</h2><div className={styles.sectionMeta}><span>最近 {recentTransactions.length} 笔</span>{overview?.transactions.length ? <button type="button" onClick={openTransactionDrawer}>查看全部<CaretRightIcon size={12} /></button> : null}</div></div>
            {recentTransactions.length ? <div className={styles.transactions}>{recentTransactions.map((transaction) => {
              const isExpense = transaction.transactionType === 'expense';
              const isTransferOut = transaction.transactionType === 'transfer_out';
              const isTransferIn = transaction.transactionType === 'transfer_in';
              const isOutflow = isExpense || isTransferOut;
              const amountClass = isExpense
                ? styles.outAmount
                : isTransferOut
                ? styles.transferOutAmount
                : isTransferIn
                ? styles.transferInAmount
                : styles.inAmount;
              return <div className={styles.transactionRow} key={transaction.id}>
                <TransactionTypeIcon type={transaction.transactionType} category={transaction.category} />
                <span className={styles.transactionBody}><strong>{transaction.note}</strong><small>{transaction.accountName} · {transaction.category} · {transaction.date.slice(5)} {transaction.time.slice(0, 5)}</small></span>
                <strong className={amountClass}>{isOutflow ? '-' : '+'}{money(transaction.amount)}</strong>
              </div>;
            })}</div> : <div className={styles.emptyState}><WalletIcon size={20} /><strong>还没有流水记录</strong><p>{overview?.accounts.length ? '点击右上角“记一笔”开始记录。' : '先添加资产账户，再记录收入或支出。'}</p>{!overview?.accounts.length && <Button type="button" variant="outline" size="sm" onClick={openAccountModal}>添加第一个账户</Button>}</div>}
          </section>

          <aside className={styles.accountPanel}>
            <section>
              <div className={styles.sectionHeading}><h2>资产账户</h2><span>{overview?.accounts.length ?? 0} 个</span></div>
              {overview?.accounts.length ? <AssetAccountDeck accounts={overview.accounts} /> : <p className={styles.emptyText}>暂无账户</p>}
              {overview?.accounts.some((account) => account.interestEnabled) && <p className={styles.yieldNote}><SparkleIcon size={13} />生息账户按年化率逐日计提，收益自动计入收入。</p>}
            </section>
          </aside>
        </div>
      </>}
    </div></div>

    <TransactionModal
      open={isTransactionModalOpen}
      accounts={overview?.accounts ?? []}
      categories={categoryOptions}
      onClose={() => setIsTransactionModalOpen(false)}
      onSubmit={submitTransaction}
    />

    <TransferModal
      open={isTransferModalOpen}
      accounts={overview?.accounts ?? []}
      onClose={() => setIsTransferModalOpen(false)}
      onSubmit={submitTransfer}
    />

    <Modal open={isAccountModalOpen} title="添加资产账户" onClose={closeAccountModal} width={500} centered>
      <form className={styles.accountForm} onSubmit={submitAccount}>
        <p className={styles.modalDescription}>记录账户当前余额；零钱通、余额宝等可开启每日收益。</p>
        {accountError && <div className={styles.modalError} role="alert">{accountError}</div>}
        <label><span>账户名称</span><input name="name" required autoFocus placeholder="例如：微信零钱通" /></label>
        <fieldset className={styles.accountTypeField}><legend>账户类型</legend><div className={styles.accountTypeGrid}>
          {ACCOUNT_TYPES.map((type) => <label key={type.value} className={accountType === type.value ? styles.accountTypeActive : ''}>
            <input type="radio" name="accountType" value={type.value} checked={accountType === type.value} onChange={() => {
              setAccountType(type.value);
              setInterestEnabled(type.interest);
            }} />
            <AccountTypeIcon type={type.value} size={20} variant="tile" /><b>{type.label}</b>
          </label>)}
        </div></fieldset>
        <label><span>当前余额</span><input name="initialBalance" type="number" min="0" step="0.01" defaultValue="0" required /></label>
        <label className={styles.checkField}><input type="checkbox" checked={interestEnabled} disabled={isYieldAccountType}
          onChange={(event) => setInterestEnabled(event.target.checked)} /><span>{isYieldAccountType ? '该账户默认自动计算每日收益' : '这是生息账户，自动计算每日收益'}</span></label>
        {interestEnabled && <label><span>当前年化收益率（%）</span><input name="annualRatePercent" type="number" min="0.000001" max="100" step="0.000001" placeholder="例如：1.85" required /></label>}
        <div className={styles.modalActions}><Button type="button" variant="outline" onClick={closeAccountModal} disabled={isSaving}>取消</Button><Button type="submit" variant="primary" disabled={isSaving}>{isSaving ? '保存中…' : '添加账户'}</Button></div>
      </form>
    </Modal>

    <TransactionDrawer
      open={isTransactionDrawerOpen}
      transactions={allTransactions}
      accounts={overview?.accounts ?? []}
      loading={isTransactionsLoading}
      error={transactionsError}
      onClose={() => setIsTransactionDrawerOpen(false)}
      onRetry={() => void loadAllTransactions()}
    />

    <AssetDetailModal
      open={isAssetDetailModalOpen}
      accounts={overview?.accounts ?? []}
      totalAssets={overview?.totalAssets ?? 0}
      onClose={() => setIsAssetDetailModalOpen(false)}
      onAddAccount={openAccountModal}
    />
  </main>;
};

export default FinancePage;
