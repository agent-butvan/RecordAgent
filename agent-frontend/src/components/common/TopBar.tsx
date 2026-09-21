import type { ReactNode } from 'react';
import { CaretLeftIcon } from '@phosphor-icons/react';
import styles from './TopBar.module.css';

interface TopBarProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  search?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}

/** 桌面工作区通用顶栏：承载页面身份、轻量上下文与页面级操作。 */
export const TopBar = ({
  title,
  subtitle,
  icon,
  actions,
  search,
  onBack,
  backLabel,
}: TopBarProps) => (
  <header className={styles.topBar} data-tauri-drag-region>
    <div className={styles.identity}>
      {onBack && (
        <>
          <button
            type="button"
            className={styles.backButton}
            onClick={onBack}
            aria-label={backLabel ? `返回${backLabel}` : '返回'}
          >
            <CaretLeftIcon size={16} />
            {backLabel && <span>{backLabel}</span>}
          </button>
          <span className={styles.divider} aria-hidden="true" />
        </>
      )}
      {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
      <h1 className={styles.title}>{title}</h1>
      {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
    </div>
    {search && <div className={styles.search}>{search}</div>}
    {actions && <div className={styles.actions}>{actions}</div>}
  </header>
);
