import React from 'react';
import { ChartNoAxesColumnIncreasing, ChevronRight } from 'lucide-react';
import type { TurnTokenUsage } from '../../types/chat';
import { formatTokenCount } from './tokenUsageFormat';
import styles from './TokenUsagePanel.module.css';

interface TokenUsagePanelProps {
  usage: TurnTokenUsage;
}

/** 在聊天右侧面板展示单轮对话的完整 Token 用量。 */
export const TokenUsagePanel: React.FC<TokenUsagePanelProps> = ({ usage }) => {
  const hasReportedUsage = usage.reportedCallCount > 0;
  const hasBreakdown = usage.estimatedInputTokens > 0;

  return (
    <section className={styles.content} aria-label="本轮 Token 用量详情">
      <header className={styles.header}>
        <div className={styles.title}>
          <ChartNoAxesColumnIncreasing size={16} aria-hidden="true" />
          本轮 Token 用量
        </div>
        <p className={styles.summary}>
          {usage.modelCallCount > 0
            ? `${usage.modelCallCount} 次模型调用 · ${formatDuration(usage.durationMillis)}`
            : '本轮没有可用的模型调用统计'}
        </p>
      </header>

      <div className={styles.body}>
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
            本轮部分模型调用失败、取消或未返回用量，合计可能偏低。
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
              {usage.calls.map((call) => (
                <div className={styles.detailItem} key={`${call.source}:${call.invocationId}`}>
                  <div className={styles.callTitle}>
                    <span className={styles.callIndex}>#{call.modelCallIndex || 1}</span>
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
