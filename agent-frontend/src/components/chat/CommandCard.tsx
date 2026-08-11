import React, { useState } from 'react';
import { Terminal, ChevronDown, ChevronRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import styles from './CommandCard.module.css';

export interface CommandCardProps {
  toolName: string;
  command: string;
  status: 'running' | 'completed' | 'failed';
  output?: string;
}

export const CommandCard: React.FC<CommandCardProps> = ({
  toolName,
  command,
  status,
  output,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className={styles.cardContainer}>
      <div className={styles.header}>
        <div className={styles.windowButtons}>
          <span className={`${styles.dot} ${styles.dotRed}`} />
          <span className={`${styles.dot} ${styles.dotYellow}`} />
          <span className={`${styles.dot} ${styles.dotGreen}`} />
        </div>
        <div className={styles.title}>
          <Terminal size={14} />
          <span>{toolName || 'Terminal Exec'}</span>
        </div>
        <div className={`${styles.statusTag} ${styles[status]}`}>
          {status === 'running' && (
            <>
              <Loader2 size={12} className={styles.spinner} />
              <span>执行中...</span>
            </>
          )}
          {status === 'completed' && (
            <>
              <CheckCircle2 size={12} />
              <span>完成</span>
            </>
          )}
          {status === 'failed' && (
            <>
              <AlertCircle size={12} />
              <span>失败</span>
            </>
          )}
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.commandLine}>
          <span className={styles.prompt}>$</span>
          <span className={styles.commandText}>{command || '准备执行终端命令...'}</span>
        </div>

        {output && (
          <>
            <button
              className={styles.toggleBtn}
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>{isExpanded ? '收起控制台输出' : '查看控制台输出'}</span>
            </button>

            {isExpanded && (
              <pre className={styles.outputArea}>
                <code>{output}</code>
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  );
};
