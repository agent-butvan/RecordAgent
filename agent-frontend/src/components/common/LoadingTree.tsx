import React from 'react';
import styles from './LoadingTree.module.css';

export interface LoadingTreeProps {
  label?: string;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

/**
 * 项目统一加载状态：以逐段生长的大树描边表达后台仍在读取数据。
 */
export const LoadingTree: React.FC<LoadingTreeProps> = ({
  label = '正在加载…',
  size = 'medium',
  className = '',
}) => (
  <div
    className={`${styles.root} ${styles[size]} ${className}`}
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <svg
      className={styles.tree}
      viewBox="0 0 96 112"
      fill="none"
      aria-hidden="true"
    >
      <path
        className={`${styles.path} ${styles.trunk}`}
        pathLength="1"
        d="M35 101c7-10 11-22 12-36m14 36c-7-11-11-23-13-36m-13 36h26"
      />
      <path
        className={`${styles.path} ${styles.branches}`}
        pathLength="1"
        d="M48 78V47m0 18L34 51m14 7l14-16M48 70l19-12M48 55L39 39"
      />
      <path
        className={`${styles.path} ${styles.crown}`}
        pathLength="1"
        d="M47 57c-5 4-13 4-18-1-8 2-15-4-14-12-7-5-5-16 3-19 0-10 11-16 19-11 4-11 19-12 25-2 10-4 20 4 18 15 8 4 9 15 2 20 0 9-10 15-18 11-4 5-12 6-18 2z"
      />
      <path
        className={`${styles.path} ${styles.ground}`}
        pathLength="1"
        d="M24 104h48"
      />
    </svg>
    {label && <span className={styles.label}>{label}</span>}
  </div>
);
