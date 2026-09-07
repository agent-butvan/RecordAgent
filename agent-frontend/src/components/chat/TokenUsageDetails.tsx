import React from 'react';
import type { TurnTokenUsage } from '../../types/chat';
import { formatTokenCount } from './tokenUsageFormat';
import styles from './TokenUsageDetails.module.css';

interface TokenUsageDetailsProps {
  usage?: TurnTokenUsage | null;
}

/** 一条 assistant 消息的低噪声 Token 用量与完整性详情。 */
export const TokenUsageDetails: React.FC<TokenUsageDetailsProps> = ({ usage }) => {
  if (!usage) return null;

  const hasReportedUsage = usage.reportedCallCount > 0;
  const summary = hasReportedUsage
    ? usage.status === 'PARTIAL'
      ? `${formatTokenCount(usage.totalTokens)} tokens · 已统计 ${usage.reportedCallCount}/${usage.modelCallCount} 次调用`
      : `${formatTokenCount(usage.totalTokens)} tokens · ${usage.modelCallCount} 次调用`
    : 'Token 统计不可用';

  return (
    <details className={styles.details}>
      <summary className={styles.summary}>{summary}</summary>
      <div className={styles.breakdown}>
        {hasReportedUsage ? (
          <dl className={styles.metrics}>
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
          </dl>
        ) : (
          <p className={styles.note}>模型供应商没有返回可靠的 Token 用量。</p>
        )}
        {usage.status === 'PARTIAL' && (
          <p className={styles.note}>本轮部分模型调用失败、取消或未返回用量，合计可能偏低。</p>
        )}
      </div>
    </details>
  );
};
