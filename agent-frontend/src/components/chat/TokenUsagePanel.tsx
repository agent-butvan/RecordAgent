import React from 'react';
import { ChartNoAxesColumnIncreasing, ChevronRight } from 'lucide-react';
import type { InputTokenBreakdown, TokenUsageSummary, ToolTokenUsage, TurnTokenUsage } from '../../types/chat';
import { Select, type SelectOption } from '../common/Select';
import { formatTokenCount } from './tokenUsageFormat';
import styles from './TokenUsagePanel.module.css';

export interface TokenUsageTurnOption {
  messageId: string;
  label: string;
  usage: TurnTokenUsage;
}

interface TokenUsagePanelProps {
  turns: TokenUsageTurnOption[];
  sessionUsageSummary?: TokenUsageSummary;
  selectedMessageId: string | null;
  onSelectionChange: (messageId: string | null) => void;
}

/** 在聊天右侧面板切换展示整个会话或单轮对话的完整 Token 用量。 */
export const TokenUsagePanel: React.FC<TokenUsagePanelProps> = ({
  turns,
  sessionUsageSummary,
  selectedMessageId,
  onSelectionChange,
}) => {
  const selectedTurn = turns.find((turn) => turn.messageId === selectedMessageId);
  const usage = selectedTurn?.usage ?? aggregateSessionUsage(turns, sessionUsageSummary);
  const scopeOptions: SelectOption[] = [
    {
      value: '',
      label: `整个会话（${sessionUsageSummary?.turnCount ?? turns.length} 轮）`,
    },
    ...turns.map((turn) => ({ value: turn.messageId, label: turn.label })),
  ];

  if (!usage) {
    return (
      <section className={styles.content} aria-label="Token 用量详情">
        <TokenPanelHeader title="Token 用量" summary="当前会话还没有可统计的 Token 用量" />
        <div className={styles.body}>
          <ScopeSelect options={scopeOptions} value="" onChange={onSelectionChange} />
          <p className={styles.empty}>完成一轮模型对话后，可在这里查看整个会话或单轮的 Token 明细。</p>
        </div>
      </section>
    );
  }

  const hasReportedUsage = usage.reportedCallCount > 0;
  const hasBreakdown = usage.estimatedInputTokens > 0;
  const scopeTitle = selectedTurn ? '本轮 Token 用量' : '整个会话 Token 用量';

  return (
    <section className={styles.content} aria-label={`${scopeTitle}详情`}>
      <TokenPanelHeader
        title={scopeTitle}
        summary={usage.modelCallCount > 0
          ? `${usage.modelCallCount} 次模型调用 · ${formatDuration(usage.durationMillis)}`
          : '没有可用的模型调用统计'}
      />

      <div className={styles.body}>
        <ScopeSelect
          options={scopeOptions}
          value={selectedTurn?.messageId ?? ''}
          onChange={onSelectionChange}
        />

        {hasReportedUsage ? (
          <section className={styles.section} aria-labelledby="token-overview-title">
            <h3 id="token-overview-title" className={styles.sectionTitle}>总览</h3>
            <dl className={styles.metrics}>
              <MetricRow label="总 Token" value={usage.totalTokens} emphasized />
              <MetricRow label="输入" value={usage.inputTokens} />
              <MetricRow label="输出" value={usage.outputTokens} />
              <MetricRow label="缓存输入" value={usage.cachedInputTokens} />
              <div>
                <dt>已统计调用</dt>
                <dd>{usage.reportedCallCount} / {usage.modelCallCount}</dd>
              </div>
              <div>
                <dt>模型耗时</dt>
                <dd>{formatDuration(usage.durationMillis)}</dd>
              </div>
            </dl>
          </section>
        ) : (
          <p className={styles.notice}>模型供应商没有返回可靠的 Token 用量。</p>
        )}

        {usage.status === 'PARTIAL' && (
          <p className={styles.notice} role="status">
            {selectedTurn ? '本轮' : '当前会话'}部分模型调用失败、取消或未返回用量，合计可能偏低。
          </p>
        )}

        {hasBreakdown && (
          <section className={styles.section} aria-labelledby="token-input-title">
            <h3 id="token-input-title" className={styles.sectionTitle}>输入构成（估算）</h3>
            <dl className={styles.metrics}>
              <MetricRow label="System Prompt" value={usage.breakdown.systemPromptTokens} />
              <MetricRow label="History" value={usage.breakdown.historyTokens} />
              <MetricRow label="Current User" value={usage.breakdown.currentUserTokens} />
              <MetricRow label="Tool Schema" value={usage.breakdown.toolSchemaTokens} />
              <MetricRow label="Tool Result" value={usage.breakdown.toolResultTokens} />
              <MetricRow label="RAG Context" value={usage.breakdown.ragContextTokens} />
              <MetricRow label="Other / Protocol" value={usage.breakdown.otherTokens} />
            </dl>
            <p className={styles.note}>分类由本地 tokenizer 估算；Input/Output 以模型供应商为准。</p>
          </section>
        )}

        {usage.toolUsages.length > 0 && (
          <DisclosureSection title="工具" count={usage.toolUsages.length}>
            <div className={styles.detailList}>
              {usage.toolUsages.map((tool) => (
                <div className={styles.detailItem} key={tool.toolName}>
                  <span className={styles.detailName}>{tool.toolName}</span>
                  <span className={styles.detailMeta}>
                    Schema {formatTokenCount(tool.schemaTokens)} · Result {formatTokenCount(tool.resultTokens)}
                  </span>
                </div>
              ))}
            </div>
          </DisclosureSection>
        )}

        {usage.calls.length > 0 && (
          <DisclosureSection title="模型调用" count={usage.calls.length}>
            <div className={styles.detailList}>
              {usage.calls.map((call, callIndex) => (
                <div className={styles.detailItem} key={`${call.source}:${call.invocationId}:${callIndex}`}>
                  <div className={styles.callTitle}>
                    <span className={styles.callIndex}>
                      #{selectedTurn ? (call.modelCallIndex || callIndex + 1) : callIndex + 1}
                    </span>
                    <span className={styles.detailName}>{call.model}</span>
                  </div>
                  <span className={styles.detailMeta}>
                    {call.inputTokens == null ? 'Input —' : `Input ${formatTokenCount(call.inputTokens)}`}
                    {' · '}
                    {call.outputTokens == null ? 'Output —' : `Output ${formatTokenCount(call.outputTokens)}`}
                  </span>
                  {(call.cachedInputTokens != null || call.durationMillis != null) && (
                    <span className={styles.detailMeta}>
                      {call.cachedInputTokens == null ? 'Cached —' : `Cached ${formatTokenCount(call.cachedInputTokens)}`}
                      {' · '}
                      {formatDuration(call.durationMillis || 0)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </DisclosureSection>
        )}
      </div>
    </section>
  );
};

const TokenPanelHeader: React.FC<{ title: string; summary: string }> = ({ title, summary }) => (
  <header className={styles.header}>
    <div className={styles.title}>
      <ChartNoAxesColumnIncreasing size={16} aria-hidden="true" />
      {title}
    </div>
    <p className={styles.summary}>{summary}</p>
  </header>
);

const ScopeSelect: React.FC<{
  options: SelectOption[];
  value: string;
  onChange: (messageId: string | null) => void;
}> = ({ options, value, onChange }) => (
  <Select
    label="查看范围"
    options={options}
    value={value}
    fullWidth
    onChange={(event) => onChange(event.target.value || null)}
  />
);

const MetricRow: React.FC<{ label: string; value: number; emphasized?: boolean }> = ({
  label,
  value,
  emphasized = false,
}) => (
  <div className={emphasized ? styles.metricEmphasized : undefined}>
    <dt>{label}</dt>
    <dd>{formatTokenCount(value)}</dd>
  </div>
);

const DisclosureSection: React.FC<React.PropsWithChildren<{ title: string; count: number }>> = ({
  title,
  count,
  children,
}) => (
  <details className={styles.disclosure}>
    <summary className={styles.disclosureSummary}>
      <ChevronRight className={styles.disclosureChevron} size={14} aria-hidden="true" />
      <span>{title}</span>
      <span className={styles.disclosureCount}>{count}</span>
    </summary>
    {children}
  </details>
);

function formatDuration(durationMillis: number): string {
  if (!durationMillis) return '—';
  if (durationMillis < 1000) return `${durationMillis} ms`;
  return `${(durationMillis / 1000).toFixed(1)} s`;
}

function aggregateSessionUsage(
  turns: TokenUsageTurnOption[],
  summary?: TokenUsageSummary,
): TurnTokenUsage | null {
  if (turns.length === 0 && !summary) return null;

  const usages = turns.map((turn) => turn.usage);
  const sum = (pick: (usage: TurnTokenUsage) => number) => usages.reduce((total, usage) => total + pick(usage), 0);
  const breakdown = usages.reduce<InputTokenBreakdown>((total, usage) => ({
    systemPromptTokens: total.systemPromptTokens + usage.breakdown.systemPromptTokens,
    historyTokens: total.historyTokens + usage.breakdown.historyTokens,
    currentUserTokens: total.currentUserTokens + usage.breakdown.currentUserTokens,
    toolSchemaTokens: total.toolSchemaTokens + usage.breakdown.toolSchemaTokens,
    toolResultTokens: total.toolResultTokens + usage.breakdown.toolResultTokens,
    ragContextTokens: total.ragContextTokens + usage.breakdown.ragContextTokens,
    otherTokens: total.otherTokens + usage.breakdown.otherTokens,
  }), emptyBreakdown());
  const toolTotals = new Map<string, ToolTokenUsage>();

  usages.flatMap((usage) => usage.toolUsages).forEach((tool) => {
    const current = toolTotals.get(tool.toolName);
    toolTotals.set(tool.toolName, {
      toolName: tool.toolName,
      schemaTokens: (current?.schemaTokens ?? 0) + tool.schemaTokens,
      resultTokens: (current?.resultTokens ?? 0) + tool.resultTokens,
    });
  });

  const fallbackStatus = usages.every((usage) => usage.status === 'UNAVAILABLE')
    ? 'UNAVAILABLE'
    : usages.some((usage) => usage.status !== 'COMPLETE') ? 'PARTIAL' : 'COMPLETE';
  const estimationDeltas = usages
    .map((usage) => usage.estimationDeltaTokens)
    .filter((value): value is number => value != null);

  return {
    inputTokens: summary?.inputTokens ?? sum((usage) => usage.inputTokens),
    outputTokens: summary?.outputTokens ?? sum((usage) => usage.outputTokens),
    cachedInputTokens: summary?.cachedInputTokens ?? sum((usage) => usage.cachedInputTokens),
    totalTokens: summary?.totalTokens ?? sum((usage) => usage.totalTokens),
    modelCallCount: summary?.modelCallCount ?? sum((usage) => usage.modelCallCount),
    reportedCallCount: summary?.reportedCallCount ?? sum((usage) => usage.reportedCallCount),
    status: summary?.status ?? fallbackStatus,
    calls: usages.flatMap((usage) => usage.calls),
    estimatedInputTokens: sum((usage) => usage.estimatedInputTokens),
    estimationDeltaTokens: estimationDeltas.length > 0
      ? estimationDeltas.reduce((total, value) => total + value, 0)
      : undefined,
    breakdown,
    toolUsages: Array.from(toolTotals.values()),
    durationMillis: sum((usage) => usage.durationMillis),
  };
}

function emptyBreakdown(): InputTokenBreakdown {
  return {
    systemPromptTokens: 0,
    historyTokens: 0,
    currentUserTokens: 0,
    toolSchemaTokens: 0,
    toolResultTokens: 0,
    ragContextTokens: 0,
    otherTokens: 0,
  };
}
