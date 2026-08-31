import React, { useState } from 'react';
import { Terminal, CheckCheck, Copy } from 'lucide-react';
import styles from './TerminalCommand.module.css';

export interface TerminalCommandProps {
  command: string;
  output?: string;
  exitCode?: number;
  durationMs?: number;
  isRunning?: boolean;
  className?: string;
}

/**
 * 终端命令执行视图：命令头 + 运行/退出状态 + 可复制输出。
 */
export const TerminalCommand: React.FC<TerminalCommandProps> = ({
  command,
  output,
  exitCode = 0,
  durationMs,
  isRunning = false,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const fullText = output ? `$ ${command}\n\n${output}` : `$ ${command}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.header}>
        <div className={styles.commandGroup}>
          <Terminal className={styles.terminalIcon} aria-hidden="true" />
          <span className={styles.prompt}>$</span>
          <span className={styles.command}>{command}</span>
        </div>

        <div className={styles.metaGroup}>
          {durationMs !== undefined && (
            <span className={styles.duration}>{durationMs}ms</span>
          )}

          {isRunning ? (
            <span className={styles.runningBadge}>
              <span className={styles.runningDot} />
              运行中
            </span>
          ) : exitCode === 0 ? (
            <span className={styles.exitOk}>exit 0</span>
          ) : (
            <span className={styles.exitFail}>exit {exitCode}</span>
          )}

          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? '已复制命令与输出' : '复制命令'}
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

      {output && (
        <div className={styles.outputArea}>
          <pre className={styles.outputPre}>
            {output.split('\n').map((line, idx) => {
              const isPass = line.includes('✓') || line.includes('PASS') || line.includes('passed');
              const isFail = line.includes('FAIL') || line.includes('Error') || line.includes('failed');
              const isWarn = line.includes('WARN') || line.includes('warning');
              const tone = isPass ? styles.linePass : isFail ? styles.lineFail : isWarn ? styles.lineWarn : styles.lineDefault;
              return (
                <div key={idx} className={`${styles.line} ${tone}`}>
                  <span>{line}</span>
                </div>
              );
            })}
          </pre>
        </div>
      )}
    </div>
  );
};
