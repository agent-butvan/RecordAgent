import type { ReactNode } from 'react';
import styles from './TopBar.module.css';

interface TopBarProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

/** 桌面工作区通用顶栏：承载页面身份、轻量上下文与页面级操作。 */
export const TopBar = ({ title, subtitle, icon, actions }: TopBarProps) => (
  <header className={styles.topBar} data-tauri-drag-region>
    <div className={styles.identity}>
      {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
      <h1 className={styles.title}>{title}</h1>
      {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
    </div>
    {actions && <div className={styles.actions}>{actions}</div>}
  </header>
);
