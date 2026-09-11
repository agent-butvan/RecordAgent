import { Activity, CalendarDays, CircleHelp, LoaderCircle, X } from 'lucide-react';
import type { SlashCommandDefinition } from '../../features/slash-command/slashCommands';
import type { DailyInsight } from '../../types/dailyInsight';
import { formatTokenCount } from './tokenUsageFormat';
import styles from './SlashCommandResult.module.css';

export type SlashCommandResultData =
  | { kind: 'help'; commands: readonly SlashCommandDefinition[]; command?: SlashCommandDefinition }
  | { kind: 'status'; data: SlashStatusData }
  | { kind: 'today'; data: DailyInsight }
  | { kind: 'loading'; message: string }
  | { kind: 'error'; message: string };

export interface SlashStatusData {
  sessionId: string;
  sessionTitle: string;
  providerName: string;
  modelName: string;
  permissionMode: string;
  totalTokens: number;
  contextTokens?: number;
  contextWindow?: number;
}

interface SlashCommandResultProps {
  result: SlashCommandResultData;
  onClose: () => void;
}

export function SlashCommandResult({ result, onClose }: SlashCommandResultProps) {
  return (
    <section className={styles.panel} aria-live="polite">
      <header className={styles.header}>
        <div className={styles.heading}>
          <ResultIcon kind={result.kind} />
          <span>{result.kind === 'status' ? '状态'
            : result.kind === 'help' ? '可用命令'
              : result.kind === 'today' ? '今日活动'
                : result.kind === 'loading' ? '正在执行' : '命令提示'}</span>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="关闭命令结果">
          <X size={15} aria-hidden="true" />
        </button>
      </header>

      {result.kind === 'help' ? <HelpContent result={result} />
        : result.kind === 'status' ? <StatusContent data={result.data} />
          : result.kind === 'today' ? <TodayContent data={result.data} />
            : <p className={result.kind === 'error' ? styles.error : styles.loading}>{result.message}</p>}
    </section>
  );
}

function ResultIcon({ kind }: { kind: SlashCommandResultData['kind'] }) {
  if (kind === 'status') return <Activity size={16} aria-hidden="true" />;
  if (kind === 'today') return <CalendarDays size={16} aria-hidden="true" />;
  if (kind === 'loading') return <LoaderCircle className={styles.spinner} size={16} aria-hidden="true" />;
  return <CircleHelp size={16} aria-hidden="true" />;
}

function HelpContent({ result }: { result: Extract<SlashCommandResultData, { kind: 'help' }> }) {
  if (result.command) {
    return (
      <div className={styles.commandDetail}>
        <code>{result.command.usage}</code>
        <p>{result.command.description}</p>
        {result.command.aliases.length > 0 && <p>别名：/{result.command.aliases.join('、/')}</p>}
      </div>
    );
  }
  return (
    <div className={styles.commandList}>
      {result.commands.map((command) => (
        <div key={command.name} className={styles.commandRow}>
          <code>/{command.name}</code>
          <span>{command.description}</span>
        </div>
      ))}
    </div>
  );
}

function StatusContent({ data }: { data: SlashStatusData }) {
  const contextRatio = data.contextTokens != null && data.contextWindow
    ? Math.min(100, Math.round((data.contextTokens / data.contextWindow) * 100))
    : null;
  return (
    <dl className={styles.statusGrid}>
      <div><dt>模型</dt><dd>{data.providerName} · {data.modelName}</dd></div>
      <div><dt>会话</dt><dd title={data.sessionId}>{data.sessionTitle} · {data.sessionId.slice(0, 8)}</dd></div>
      <div><dt>权限模式</dt><dd>{data.permissionMode}</dd></div>
      <div><dt>会话 Token</dt><dd>{formatTokenCount(data.totalTokens)}</dd></div>
      <div className={styles.contextRow}>
        <dt>上下文窗口</dt>
        <dd>
          {data.contextTokens == null
            ? '暂无可用调用数据'
            : data.contextWindow
              ? `${formatTokenCount(data.contextTokens)} / ${formatTokenCount(data.contextWindow)}（${contextRatio}%）`
              : `${formatTokenCount(data.contextTokens)} / 上限未知`}
        </dd>
        {contextRatio != null && <progress max="100" value={contextRatio} aria-label={`上下文窗口已使用 ${contextRatio}%`} />}
      </div>
    </dl>
  );
}

const MONEY_FORMATTER = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' });

function TodayContent({ data }: { data: DailyInsight }) {
  const categories = Object.entries(data.finance.expenseCategories)
    .sort((left, right) => right[1] - left[1])
    .map(([name, amount]) => `${name} ${MONEY_FORMATTER.format(amount)}`)
    .join(' · ');
  return (
    <div>
      <p className={styles.insightDate}>{data.date}</p>
      <dl className={styles.insightGrid}>
        <div><dt>待办</dt><dd>{data.todos.completed} / {data.todos.total}</dd><small>{data.todos.pending} 项待完成</small></div>
        <div><dt>日程</dt><dd>{data.scheduleCount} 项</dd><small>今日安排</small></div>
        <div><dt>资料</dt><dd>{data.records.createdCount} 篇</dd><small>今日新增</small></div>
        <div><dt>花销</dt><dd>{MONEY_FORMATTER.format(data.finance.expenseTotal)}</dd><small>{data.finance.expenseCount} 笔{categories ? ` · ${categories}` : ''}</small></div>
        <div><dt>学习</dt><dd>{formatStudyDuration(data.study.durationSeconds)}</dd><small>{data.study.sessionCount} 次记录</small></div>
      </dl>
    </div>
  );
}

function formatStudyDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0) return remainingMinutes > 0 ? `${hours} 小时 ${remainingMinutes} 分钟` : `${hours} 小时`;
  return `${minutes} 分钟`;
}
