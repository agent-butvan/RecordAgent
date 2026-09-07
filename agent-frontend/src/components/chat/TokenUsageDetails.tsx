import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { TurnTokenUsage } from '../../types/chat';
import { formatTokenCount } from './tokenUsageFormat';
import styles from './TokenUsageDetails.module.css';

interface TokenUsageDetailsProps {
  usage?: TurnTokenUsage | null;
}

/** 一条 assistant 消息的低噪声 Token 用量与完整性详情。 */
export const TokenUsageDetails: React.FC<TokenUsageDetailsProps> = ({ usage }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!usage) return null;

  const hasReportedUsage = usage.reportedCallCount > 0;
  const hasBreakdown = usage.estimatedInputTokens > 0;
  const summary = hasReportedUsage
    ? usage.status === 'PARTIAL'
      ? `${formatTokenCount(usage.totalTokens)} tokens · 已统计 ${usage.reportedCallCount}/${usage.modelCallCount} 次调用`
      : `${formatTokenCount(usage.totalTokens)} tokens · ${usage.modelCallCount} 次调用`
    : 'Token 统计不可用';

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronDown className={styles.chevron} size={13} aria-hidden="true" />
        <span>{summary}</span>
      </button>
      {open && (
        <div id={panelId} className={styles.popover} role="group" aria-label="本轮 Token 用量详情">
          <div className={styles.popoverTitle}>本轮 Token 用量</div>
          {hasReportedUsage ? (
            <dl className={styles.metrics}>
              <div className={styles.totalRow}>
                <dt>总 Token</dt>
                <dd>{formatTokenCount(usage.totalTokens)}</dd>
              </div>
              <div>
                <dt>输入</dt>
                <dd>{formatTokenCount(usage.inputTokens)}</dd>
              </div>
              <div>
                <dt>输出</dt>
                <dd>{formatTokenCount(usage.outputTokens)}</dd>
              </div>
              <div>
                <dt>缓存输入</dt>
                <dd>{formatTokenCount(usage.cachedInputTokens)}</dd>
              </div>
              <div>
                <dt>LLM Calls</dt>
                <dd>{usage.modelCallCount}</dd>
              </div>
              <div>
                <dt>模型耗时</dt>
                <dd>{formatDuration(usage.durationMillis)}</dd>
              </div>
            </dl>
          ) : (
            <p className={styles.note}>模型供应商没有返回可靠的 Token 用量。</p>
          )}
          {usage.status === 'PARTIAL' && (
            <p className={styles.note}>本轮部分模型调用失败、取消或未返回用量，合计可能偏低。</p>
          )}
          {hasBreakdown && (
            <section className={styles.section} aria-label="输入 Token 构成">
              <div className={styles.sectionTitle}>输入构成（估算）</div>
              <dl className={styles.metrics}>
                <TokenRow label="System Prompt" value={usage.breakdown.systemPromptTokens} />
                <TokenRow label="History" value={usage.breakdown.historyTokens} />
                <TokenRow label="Current User" value={usage.breakdown.currentUserTokens} />
                <TokenRow label="Tool Schema" value={usage.breakdown.toolSchemaTokens} />
                <TokenRow label="Tool Result" value={usage.breakdown.toolResultTokens} />
                <TokenRow label="RAG Context" value={usage.breakdown.ragContextTokens} />
                <TokenRow label="Other / Protocol" value={usage.breakdown.otherTokens} />
              </dl>
              <p className={styles.note}>分类由本地 tokenizer 估算；Input/Output 以模型供应商为准。</p>
            </section>
          )}
          {usage.toolUsages.length > 0 && (
            <section className={styles.section} aria-label="工具 Token 构成">
              <div className={styles.sectionTitle}>Tools</div>
              <div className={styles.compactList}>
                {usage.toolUsages.map((tool) => (
                  <div key={tool.toolName}>
                    <span>{tool.toolName}</span>
                    <span>schema {formatTokenCount(tool.schemaTokens)} · result {formatTokenCount(tool.resultTokens)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
          {usage.calls.length > 0 && (
            <section className={styles.section} aria-label="模型调用明细">
              <div className={styles.sectionTitle}>Model Calls</div>
              <div className={styles.compactList}>
                {usage.calls.map((call) => (
                  <div key={`${call.source}:${call.invocationId}`}>
                    <span>#{call.modelCallIndex || 1} · {call.model}</span>
                    <span>{call.inputTokens == null ? 'Input —' : `Input ${formatTokenCount(call.inputTokens)}`} · {call.outputTokens == null ? 'Output —' : `Output ${formatTokenCount(call.outputTokens)}`}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

const TokenRow: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div><dt>{label}</dt><dd>{formatTokenCount(value)}</dd></div>
);

function formatDuration(durationMillis: number): string {
  if (!durationMillis) return '—';
  if (durationMillis < 1000) return `${durationMillis} ms`;
  return `${(durationMillis / 1000).toFixed(1)} s`;
}
