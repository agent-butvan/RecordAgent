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
      )}
    </div>
  );
};
