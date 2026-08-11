import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';
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
  // 默认收起折叠，用户点击时手动展开
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const displayCommand = command || '准备执行终端命令...';
  const isRunning = status === 'running';

  return (
    <div className={styles.commandContainer}>
      {/* 极简 Header 行 */}
      <div
        className={styles.commandHeader}
        onClick={() => !isRunning && setIsExpanded(!isExpanded)}
      >
        <span className={styles.terminalIcon}>&gt;_</span>
        
        {isRunning ? (
          <span className={`${styles.commandTitle} ${styles.runningTitle}`}>
            正在运行 {displayCommand}
          </span>
        ) : (
          <>
            <span className={styles.commandTitle}>
              {isExpanded ? (toolName === 'execute' ? '运行了命令' : `运行了 ${toolName}`) : `已运行 ${displayCommand}`}
            </span>
            {isExpanded ? (
              <ChevronDown size={14} className={styles.arrowIcon} />
            ) : (
              <ChevronRight size={14} className={styles.arrowIcon} />
            )}
          </>
        )}
      </div>

      {/* 展开后的极简浅灰代码卡片 */}
      {isExpanded && !isRunning && (
        <div className={styles.codeCard}>
          <div className={styles.commandText}>
            <span className={styles.promptSymbol}>$</span>
            {displayCommand}
          </div>

          {output && (
            <pre className={styles.outputArea}>
              <code>{output}</code>
            </pre>
          )}

          <div className={styles.cardFooter}>
            <Check size={13} style={{ color: '#6b7280' }} />
            <span className={styles.successText}>成功</span>
          </div>
        </div>
      )}
    </div>
  );
};
