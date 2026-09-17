import { Check, ShieldAlert, X } from 'lucide-react';
import type { PreparedAnalysisCommand } from '../../features/slash-command/analysisCommands';
import styles from './AnalysisPrivacyCard.module.css';

export function AnalysisPrivacyCard({ analysis, onCancel, onConfirm }: {
  analysis: PreparedAnalysisCommand;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <section className={styles.card} aria-label="个人数据发送确认">
      <div className={styles.heading}>
        <ShieldAlert size={18} aria-hidden="true" />
        <div>
          <p className={styles.title}>确认发送个人数据</p>
          <p className={styles.subtitle}>本次授权仅用于这一轮分析，不会被记住。</p>
        </div>
      </div>
      <p className={styles.description}>以下本地数据将作为上下文发送给当前模型供应商：</p>
      <dl className={styles.details}>
        <div><dt>数据</dt><dd>{analysis.sourceLabel}</dd></div>
        <div><dt>范围</dt><dd>{analysis.scopeLabel}</dd></div>
      </dl>
      <div className={styles.actions}>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          <X size={15} aria-hidden="true" />取消
        </button>
        <button type="button" className={styles.confirm} onClick={onConfirm}>
          <Check size={15} aria-hidden="true" />确认并发送
        </button>
      </div>
    </section>
  );
}
