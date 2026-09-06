import type { ReactNode } from 'react';
import styles from './SettingsPageLayout.module.css';

interface SettingsPageLayoutProps {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}

/** 设置详情页统一骨架：对齐模型配置页的内容宽度、标题层级和操作区。 */
export function SettingsPageLayout({ title, description, actions, children }: SettingsPageLayoutProps) {
  return (
    <section className={styles.page} aria-labelledby="settings-page-title">
      <header className={styles.header}>
        <div>
          <h1 id="settings-page-title">{title}</h1>
          <p>{description}</p>
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      <div className={styles.content}>{children}</div>
    </section>
  );
}
