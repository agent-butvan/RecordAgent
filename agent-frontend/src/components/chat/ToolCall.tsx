import React, { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Loader2, XCircle } from 'lucide-react';
import type { TraceNode } from '../../types/chat';
import styles from './ToolCall.module.css';

export type ToolCallStatus = 'running' | 'success' | 'failed';

export interface ToolCallResult {
  count?: number;
  items?: string[];
  text?: string;
}

export interface ToolCallProps {
  tool: string;
  status: ToolCallStatus;
  arguments?: Record<string, unknown> | string;
  result?: string | string[] | ToolCallResult;
  resultCount?: number;
  /** 文件类工具（read_file / write_file）正在读取或写入的目标路径 */
  file?: string;
  /** 执行中状态右侧展示的目标信息（如终端命令、文件路径） */
  runningLabel?: string;
  output?: string;
  exitCode?: number;
  durationMs?: number;
  error?: string;
  className?: string;
  defaultOpen?: boolean;
}

function formatArguments(args?: Record<string, unknown> | string): string {
  if (args == null) return '';
  if (typeof args === 'string') return args;
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
}

function formatResult(
  result: ToolCallProps['result']
): { items: string[]; text: string } {
  if (result == null) return { items: [], text: '' };
  if (typeof result === 'string') return { items: [], text: result };
  if (Array.isArray(result)) return { items: result, text: '' };
  if (Array.isArray(result.items)) return { items: result.items, text: result.text || '' };
  return { items: [], text: result.text || '' };
}

/**
 * Agent 工具调用记录卡片：
 * 状态图标 + 等宽工具名 + 右侧摘要 + 展开后的 ARGUMENTS / RESULT / ERROR。
 */
export const ToolCall: React.FC<ToolCallProps> = ({
  tool,
  status,
  arguments: args,
  result,
  resultCount,
  file,
  runningLabel,
  output,
  exitCode,
  durationMs,
  error,
  className = '',
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const expandable = status !== 'running';

  const summary = useMemo(() => {
    if (status === 'running') return runningLabel || file || '执行中…';
    if (status === 'failed') return 'failed';
    if (exitCode !== undefined) {
      return `${exitCode === 0 ? 'exit 0' : `exit ${exitCode}`}${
        durationMs != null ? ` · ${durationMs}ms` : ''
      }`;
    }
    const { items, text } = formatResult(result);
    const count =
      resultCount ??
      (Array.isArray(result) ? result.length : undefined) ??
      (items.length > 0 ? items.length : undefined) ??
      (text ? 1 : undefined);
    if (count != null) return `${count} ${count === 1 ? 'result' : 'results'}`;
    return '完成';
  }, [status, runningLabel, file, exitCode, durationMs, resultCount, result]);

  const argsText = formatArguments(args);
  const { items, text } = formatResult(result);
  const hasArgs = argsText.length > 0;
  const hasResult = items.length > 0 || text.length > 0 || Boolean(output);

  return (
    <div className={`${styles.card} ${className}`}>
      <button
        type="button"
        className={styles.header}
        onClick={() => expandable && setOpen((v) => !v)}
        aria-expanded={expandable ? open : undefined}
        disabled={!expandable}
      >
        <span
          className={`${styles.icon} ${
            status === 'success'
              ? styles.iconSuccess
              : status === 'failed'
              ? styles.iconFailed
              : styles.iconRunning
          }`}
        >
          {status === 'success' ? (
            <CheckCircle2 size={16} aria-hidden="true" />
          ) : status === 'failed' ? (
            <XCircle size={16} aria-hidden="true" />
          ) : (
            <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
          )}
        </span>

        <span className={styles.toolName}>{tool}</span>

        <span className={styles.headerRight}>
          <span className={`${styles.summary} ${status === 'failed' ? styles.summaryFailed : ''}`}>
            {summary}
          </span>
          {expandable && (
            <ChevronDown
              size={14}
              className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
              aria-hidden="true"
            />
          )}
        </span>
      </button>

      {expandable && (
        <div className={`${styles.details} ${open ? styles.detailsOpen : ''}`}>
          <div className={styles.detailsInner}>
            <div className={styles.detailsBody}>
              {hasArgs && (
                <section className={styles.section}>
                  <h4 className={styles.sectionLabel}>Arguments</h4>
                  <pre className={styles.code}>{argsText}</pre>
                </section>
              )}

              {status === 'failed' && error && (
                <section className={styles.section}>
                  <h4 className={styles.sectionLabel}>Error</h4>
                  <pre className={`${styles.code} ${styles.errorText}`}>{error}</pre>
                </section>
              )}

              {hasResult && (
                <section className={styles.section}>
                  <h4 className={styles.sectionLabel}>Result</h4>
                  {output != null ? (
                    <pre className={styles.code}>{output}</pre>
                  ) : items.length > 0 ? (
                    <ul className={styles.resultList}>
                      {items.map((item, i) => (
                        <li key={i} className={styles.resultItem}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <pre className={styles.code}>{text}</pre>
                  )}
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** 将时间线 TraceNode 映射为 ToolCall 卡片属性。 */
export function toolNodeToToolCallProps(node: TraceNode): ToolCallProps {
  const status: ToolCallStatus =
    node.status === 'failed'
      ? 'failed'
      : node.status === 'running' || node.status === 'pending'
      ? 'running'
      : 'success';

  // 仅按工具名判断终端命令执行；其余工具即使带 command（参数 JSON / 路径）也不进终端分支
  const isCommand =
    node.type === 'terminal' ||
    node.toolName === 'execute_command' ||
    node.toolName === 'execute' ||
    node.toolName === 'terminal';

  if (isCommand) {
    return {
      // 显示真实工具名（execute / execute_command / terminal），终端执行命令作为参数展示
      tool: node.toolName || 'terminal',
      status,
      arguments: node.command ? { command: node.command } : undefined,
      output: node.output,
      result: node.output,
      exitCode: node.exitCode,
      durationMs: node.durationMs,
      runningLabel: node.command,
    };
  }

  const toolName = node.toolName || node.primary || node.type;
  const items = node.sources?.map((s) => s.name) || node.details?.map((d) => d.text);
  const failedLine = node.details?.find((d) => d.tone === 'error')?.text;

  // 非命令工具：command 可能是 JSON 参数（如 web_search 的 {query, max_results}）或文件路径
  let parsedArgs: Record<string, unknown> | null = null;
  if (node.command) {
    const trimmed = node.command.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        parsedArgs = JSON.parse(trimmed);
      } catch {
        parsedArgs = null;
      }
    }
  }

  const isFileTool = ['read_file', 'write_file', 'edit_file'].includes(toolName);
  const query =
    parsedArgs && typeof parsedArgs.query === 'string' ? parsedArgs.query : undefined;
  const filePath = isFileTool ? node.secondary : undefined;

  return {
    tool: toolName,
    status,
    arguments:
      (node.args as Record<string, unknown> | undefined) ??
      (typeof node.args === 'string' ? node.args : undefined) ??
      parsedArgs ??
      undefined,
    result:
      (items && items.length > 0 ? items : undefined) ??
      (node.result as ToolCallProps['result'] | undefined),
    resultCount: node.sources?.length,
    file: filePath,
    runningLabel: query || filePath || undefined,
    error: status === 'failed' ? failedLine : undefined,
  };
}
