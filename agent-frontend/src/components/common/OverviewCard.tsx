import { useId, type ReactNode } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { LoadingTree } from './LoadingTree';
import styles from './OverviewCard.module.css';

export interface OverviewCardProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

/** 概览卡片模板：统一标题、操作、加载和错误状态，正文与页脚由业务域扩展。 */
export function OverviewCard({ eyebrow, title, description, action, footer, children, loading, error, onRetry, className = '' }: OverviewCardProps) {
  const titleId = useId();
  return <Card className={`${styles.card} ${className}`} role="region" aria-labelledby={titleId} aria-busy={loading}>
    <header className={styles.header}>
      <div>{eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}<h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div>
      {action}
    </header>
    <div className={styles.body}>
      {loading ? <div className={styles.state}><LoadingTree label={`正在读取${title}…`} /></div>
        : error ? <div className={styles.state} role="alert"><p>{error}</p>{onRetry && <Button type="button" size="sm" variant="outline" onClick={onRetry}>重新加载</Button>}</div>
        : children}
    </div>
    {footer && !loading && !error && <footer className={styles.footer}>{footer}</footer>}
  </Card>;
}
