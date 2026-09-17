import React from 'react';
import { ChevronRight } from 'lucide-react';
import type { TurnTokenUsage } from '../../types/chat';
import { formatTokenCount } from './tokenUsageFormat';
import styles from './TokenUsageTrigger.module.css';

interface TokenUsageTriggerProps {
  usage?: TurnTokenUsage | null;
  active?: boolean;
  onOpen: () => void;
}

/** 一条 assistant 消息底部的低噪声 Token 详情入口。 */
export const TokenUsageTrigger: React.FC<TokenUsageTriggerProps> = ({ usage, active = false, onOpen }) => {
  if (!usage) return null;

  const hasReportedUsage = usage.reportedCallCount > 0;
  const summary = hasReportedUsage
    ? usage.status === 'PARTIAL'
      ? `${formatTokenCount(usage.totalTokens)} tokens · 已统计 ${usage.reportedCallCount}/${usage.modelCallCount} 次调用`
      : `${formatTokenCount(usage.totalTokens)} tokens · ${usage.modelCallCount} 次调用`
    : 'Token 统计不可用';

  return (
    <button
      type="button"
      className={styles.trigger}
      aria-expanded={active}
      aria-controls="right-panel-content"
      aria-label={`${summary}，在右侧面板查看本轮 Token 用量详情`}
      onClick={onOpen}
    >
      <span>{summary}</span>
      <ChevronRight className={styles.chevron} size={13} aria-hidden="true" />
    </button>
  );
};
