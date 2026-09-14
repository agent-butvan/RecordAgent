import { Check, ShieldAlert } from 'lucide-react';
import styles from './PermissionRequestCard.module.css';

interface PermissionResumeCardProps {
  isSubmitting: boolean;
  onResume: () => void;
}

/** 已完成逐项决定但尚未建立恢复流时，提供幂等的继续入口。 */
export function PermissionResumeCard({ isSubmitting, onResume }: PermissionResumeCardProps) {
  return (
    <section className={styles.card} aria-label="继续已确认的任务">
      <div className={styles.heading}>
        <ShieldAlert size={18} aria-hidden="true" />
        <div>
          <p className={styles.title}>操作已确认</p>
          <p className={styles.progress}>任务尚未恢复执行</p>
        </div>
      </div>
      <p className={styles.description}>可以继续原任务，不会创建新的对话轮次。</p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.allow}
          disabled={isSubmitting}
          onClick={onResume}
        >
          <Check size={15} aria-hidden="true" />
          {isSubmitting ? '正在恢复…' : '继续执行'}
        </button>
      </div>
    </section>
  );
}
