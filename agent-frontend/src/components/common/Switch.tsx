import type { FC } from 'react';
import styles from './Switch.module.css';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  busy?: boolean;
  title?: string;
  className?: string;
}

/** 紧凑型布尔开关，统一键盘、忙碌态与可访问性语义。 */
export const Switch: FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  busy = false,
  title,
  className,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    aria-busy={busy}
    className={`${styles.control} ${className ?? ''}`}
    disabled={disabled || busy}
    title={title}
    onClick={() => onChange(!checked)}
  >
    <span className={styles.label}>{label}</span>
    <span className={`${styles.track} ${checked ? styles.trackChecked : ''}`} aria-hidden="true">
      <span className={styles.thumb} />
    </span>
  </button>
);
