import { DotsSixVertical, X } from '@phosphor-icons/react';
import type { StudySession } from '../../types/study';
import styles from './ActiveStudyCard.module.css';

function formatTimer(seconds: number): string {
  return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60]
    .map((value) => String(Math.max(0, Math.floor(value))).padStart(2, '0'))
    .join(':');
}

function formatClock(instant: string): string {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(instant));
}

interface ActiveStudyCardProps {
  session: StudySession;
  elapsedSeconds: number;
  saving?: boolean;
  compact?: boolean;
  draggable?: boolean;
  onFinish: () => void;
  onHide?: () => void;
  error?: string | null;
}

/** 在记录页面、应用内浮窗和系统小窗之间复用的活动学习状态。 */
export function ActiveStudyCard({
  session,
  elapsedSeconds,
  saving = false,
  compact = false,
  draggable = false,
  onFinish,
  onHide,
  error,
}: ActiveStudyCardProps) {
  return (
    <article className={`${styles.card} ${compact ? styles.compact : ''}`} aria-label="正在学习">
      <header className={styles.header} data-tauri-drag-region={draggable ? true : undefined}>
        {draggable && <DotsSixVertical size={16} className={styles.dragIcon} aria-hidden="true" />}
        <span className={styles.status}><i />正在学习</span>
        {onHide && (
          <button type="button" className={styles.hideButton} onClick={onHide} aria-label="隐藏学习小窗" title="隐藏小窗">
            <X size={14} />
          </button>
        )}
      </header>
      <strong className={styles.content} title={session.content}>{session.content}</strong>
      <time className={styles.timer}>{formatTimer(elapsedSeconds)}</time>
      <span className={styles.startedAt}>开始于 {formatClock(session.startedAt)} · {session.category}</span>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button type="button" className={styles.finishButton} onClick={onFinish} disabled={saving}>
        {saving ? '正在结束…' : '结束这段学习'}
      </button>
    </article>
  );
}
