import { useEffect, useRef, useState } from 'react';
import { createDailyRecord, formatLocalDate } from '../../../services/dailyEvents';
import { createFinanceTransaction, fetchFinanceCategories, fetchFinanceOverview } from '../../../services/financeApi';
import type { CalendarRecordDraft } from '../../../types/calendar';
import type { FinanceAccount, FinanceCategoryOptions } from '../../../types/finance';
import type { RecordEntry, RecordType } from '../../../types/record';
import { CalendarQuickCreate } from '../../calendar/CalendarQuickCreate';
import { TransactionModal } from '../../finance/TransactionModal';
import { useMessage } from '../../common/Message';
import { TodoSummaryTile, TodoListTile } from './TodoOverviewCard';
import { FinanceTile, FinanceMiniTile } from './FinanceOverviewCard';
import { DocsTile, DocsListTile } from './RecordsOverviewCard';
import { LearningTile } from './StudyOverviewCard';
import styles from './SessionOverview.module.css';

export interface SessionOverviewProps {
  onOpenFeature: (feature: 'calendar' | 'finance' | 'study') => void;
  /** undefined 打开列表，null 新建资料，其余打开指定资料。 */
  onOpenRecords: (entry?: RecordEntry | null, initialType?: RecordType) => void;
  onCompose: (prompt: string) => void;
}

/** 无消息会话的个人概览；业务操作沿用现有服务与编辑组件，不创建独立数据副本。 */
export function SessionOverview({ onOpenFeature, onOpenRecords, onCompose }: SessionOverviewProps) {
  const { showMessage } = useMessage();
  const [date, setDate] = useState(() => formatLocalDate(new Date()));
  const [refreshKey, setRefreshKey] = useState(0);
  const [financeForm, setFinanceForm] = useState<{ date: string; accounts: FinanceAccount[]; categories: FinanceCategoryOptions } | null>(null);
  const [openingFinance, setOpeningFinance] = useState(false);
  const lifecycle = useRef({ active: false, openingFinance: false }).current;
  useEffect(() => {
    lifecycle.active = true;
    return () => { lifecycle.active = false; };
  }, [lifecycle]);
  useEffect(() => {
    const update = () => setDate(formatLocalDate(new Date()));
    const timer = window.setInterval(update, 30_000);
    window.addEventListener('focus', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); };
  }, []);
  const create = async (draft: CalendarRecordDraft) => {
    await createDailyRecord(new Date(`${date}T12:00:00`), draft);
    setRefreshKey((value) => value + 1);
    showMessage('success', '记录已保存');
  };
  const openFinance = async () => {
    if (lifecycle.openingFinance) return;
    lifecycle.openingFinance = true;
    setOpeningFinance(true);
    try {
      const [overview, categories] = await Promise.all([fetchFinanceOverview(), fetchFinanceCategories()]);
      if (!lifecycle.active) return;
      if (!overview.accounts.length) {
        showMessage('info', '请先添加一个资产账户，再记录收支。');
        onOpenFeature('finance');
      } else setFinanceForm({ date, accounts: overview.accounts, categories });
    } catch (cause) {
      if (lifecycle.active) showMessage('error', cause instanceof Error ? cause.message : '记账表单加载失败，请重试。');
    } finally {
      lifecycle.openingFinance = false;
      if (lifecycle.active) setOpeningFinance(false);
    }
  };
  const dateValue = new Date(`${date}T12:00:00`);
  const dateText = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(dateValue);
  const weekdayText = new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(dateValue);

  return (
    <section className={styles.layoutWrap} aria-label="今日概览">
      <header className={styles.welcome}>
        <div>
          <h1>今天，想从哪件事开始？</h1>
          <p>先看一眼你今天的状态，再直接交给 Agent 继续推进。</p>
        </div>
        <div className={styles.welcomeRight}>
          <time className={styles.date} dateTime={date}>{dateText} · {weekdayText}</time>
          <CalendarQuickCreate
            selectedDate={new Date(`${date}T12:00:00`)}
            onCreate={create}
            onWriteJournal={() => onOpenRecords(null, 'journal')}
            onCreateFinance={() => void openFinance()}
          />
        </div>
      </header>

      {openingFinance && <p className={styles.muted} role="status">正在准备记账表单…</p>}

      <div className={styles.bento}>
        <TodoSummaryTile key={`todo-summary-${date}`} date={date} refreshKey={refreshKey} onOpenCalendar={() => onOpenFeature('calendar')} />
        <TodoListTile key={`todo-list-${date}`} date={date} refreshKey={refreshKey} onCompose={onCompose} />
        <FinanceTile key={`finance-${date}`} date={date} refreshKey={refreshKey} onCreate={() => void openFinance()} />
        <FinanceMiniTile key={`finance-mini-${date}`} date={date} refreshKey={refreshKey} onOpenFinance={() => onOpenFeature('finance')} />
        <DocsTile key={`docs-${date}`} date={date} onOpen={onOpenRecords} />
        <DocsListTile key={`docs-list-${date}`} date={date} onOpen={onOpenRecords} />
        <LearningTile key={`learning-${date}`} date={date} onOpenStudy={() => onOpenFeature('study')} />
      </div>

      {financeForm && (
        <TransactionModal
          open
          accounts={financeForm.accounts}
          categories={financeForm.categories}
          defaultDate={financeForm.date}
          onClose={() => setFinanceForm(null)}
          onSubmit={async (input) => {
            await createFinanceTransaction(input);
            setRefreshKey((value) => value + 1);
            showMessage('success', '流水已保存');
          }}
        />
      )}
    </section>
  );
}
