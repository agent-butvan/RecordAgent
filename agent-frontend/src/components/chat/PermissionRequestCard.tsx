import { useState } from 'react';
import { ShieldAlert, Check, X } from 'lucide-react';
import type { PermissionToolPayload } from '../../services/api';
import styles from './PermissionRequestCard.module.css';

interface PermissionRequestCardProps {
  tool: PermissionToolPayload;
  isSubmitting: boolean;
  onDecision: (approved: boolean, rememberForSession: boolean) => void;
}

/** 在聊天上下文中逐条展示、确认高风险工具调用。 */
export function PermissionRequestCard({
  tool,
  isSubmitting,
  onDecision,
}: PermissionRequestCardProps) {
  const [rememberForSession, setRememberForSession] = useState(false);
  const input = JSON.stringify(tool.input, null, 2);

  const submit = (approved: boolean) => {
    onDecision(approved, rememberForSession);
  };

  return (
    <section className={styles.card} aria-label="工具权限确认">
      <div className={styles.heading}>
        <ShieldAlert size={18} aria-hidden="true" />
        <div>
          <p className={styles.title}>需要你的确认</p>
          <p className={styles.progress}>第 {tool.index} / {tool.total} 项</p>
        </div>
      </div>

      <p className={styles.description}>{tool.riskDescription}</p>
      <dl className={styles.details}>
        <div>
          <dt>工具</dt>
          <dd>{tool.toolName}</dd>
        </div>
        <div>
          <dt>参数</dt>
          <dd><pre>{input}</pre></dd>
        </div>
      </dl>

      <label className={styles.remember}>
        <input
          type="checkbox"
          checked={rememberForSession}
          disabled={isSubmitting}
          onChange={(event) => setRememberForSession(event.target.checked)}
        />
        本会话记住此完全相同的操作
      </label>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.deny}
          disabled={isSubmitting}
          onClick={() => submit(false)}
        >
          <X size={15} aria-hidden="true" />
          拒绝
        </button>
        <button
          type="button"
          className={styles.allow}
          disabled={isSubmitting}
          onClick={() => submit(true)}
        >
          <Check size={15} aria-hidden="true" />
          {isSubmitting ? '正在提交…' : '允许'}
        </button>
      </div>
    </section>
  );
}
