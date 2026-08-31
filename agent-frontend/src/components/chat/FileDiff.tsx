import React, { useState } from 'react';
import { Code2, CheckCheck, Copy } from 'lucide-react';
import type { DiffRow } from '../../types/chat';
import styles from './FileDiff.module.css';

export interface FileDiffProps {
  file: string;
  rows?: DiffRow[];
  className?: string;
}

/**
 * 文件差异视图：行号 gutter + 增删行高亮 + 复制。
 */
export const FileDiff: React.FC<FileDiffProps> = ({ file, rows = [], className = '' }) => {
  const [copied, setCopied] = useState(false);
  const added = rows.filter((r) => r.type === 'add').length;
  const removed = rows.filter((r) => r.type === 'del').length;

  const handleCopy = () => {
    const textContent = rows
      .map((r) => `${r.type === 'add' ? '+' : r.type === 'del' ? '-' : ' '} ${r.text}`)
      .join('\n');
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.header}>
        <div className={styles.fileGroup}>
          <Code2 className={styles.fileIcon} aria-hidden="true" />
          <span className={styles.fileName}>{file}</span>
        </div>

        <div className={styles.metaGroup}>
          <div className={styles.counts}>
            {added > 0 && <span className={styles.addCount}>+{added}</span>}
            {removed > 0 && <span className={styles.delCount}>−{removed}</span>}
          </div>

          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? '已复制差异' : '复制差异'}
            className={styles.copyBtn}
          >
            {copied ? (
              <CheckCheck className={styles.copyOkIcon} aria-hidden="true" />
            ) : (
              <Copy className={styles.copyIcon} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <div className={styles.lines}>
        {rows.map((r, i) => (
          <div
            key={i}
            className={`${styles.row} ${
              r.type === 'add' ? styles.rowAdd : r.type === 'del' ? styles.rowDel : styles.rowCtx
            }`}
          >
            {r.type === 'add' && <span className={styles.addBar} aria-hidden="true" />}
            {r.type === 'del' && <span className={styles.delBar} aria-hidden="true" />}

            <span className={`${styles.lineNo} ${r.type === 'del' ? styles.lineNoDel : ''}`}>
              {r.old ?? ''}
            </span>
            <span className={`${styles.lineNo} ${r.type === 'add' ? styles.lineNoAdd : ''}`}>
              {r.cur ?? ''}
            </span>
            <span className={`${styles.marker} ${r.type === 'add' ? styles.markerAdd : r.type === 'del' ? styles.markerDel : ''}`}>
              {r.type === 'add' ? '+' : r.type === 'del' ? '−' : ''}
            </span>
            <code className={`${styles.code} ${r.type === 'add' ? styles.codeAdd : r.type === 'del' ? styles.codeDel : ''}`}>
              {r.text}
            </code>
          </div>
        ))}
      </div>
    </div>
  );
};
