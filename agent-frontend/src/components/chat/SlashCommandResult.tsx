import { Activity, CircleHelp, X } from 'lucide-react';
import type { SlashCommandDefinition } from '../../features/slash-command/slashCommands';
import { formatTokenCount } from './tokenUsageFormat';
import styles from './SlashCommandResult.module.css';

export type SlashCommandResultData =
  | { kind: 'help'; commands: readonly SlashCommandDefinition[]; command?: SlashCommandDefinition }
  | { kind: 'status'; data: SlashStatusData }
  | { kind: 'error'; message: string };

export interface SlashStatusData {
  sessionId: string;
  sessionTitle: string;
  providerName: string;
  modelName: string;
  permissionMode: string;
  totalTokens: number;
  contextTokens?: number;
  contextWindow?: number;
}

interface SlashCommandResultProps {
  result: SlashCommandResultData;
  onClose: () => void;
}

export function SlashCommandResult({ result, onClose }: SlashCommandResultProps) {
  return (
    <section className={styles.panel} aria-live="polite">
      <header className={styles.header}>
        <div className={styles.heading}>
          {result.kind === 'status'
            ? <Activity size={16} aria-hidden="true" />
            : <CircleHelp size={16} aria-hidden="true" />}
          <span>{result.kind === 'status' ? '状态' : result.kind === 'help' ? '可用命令' : '命令提示'}</span>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="关闭命令结果">
          <X size={15} aria-hidden="true" />
        </button>
      </header>

      {result.kind === 'help' ? <HelpContent result={result} />
        : result.kind === 'status' ? <StatusContent data={result.data} />
          : <p className={styles.error}>{result.message}</p>}
    </section>
  );
}

function HelpContent({ result }: { result: Extract<SlashCommandResultData, { kind: 'help' }> }) {
  if (result.command) {
    return (
      <div className={styles.commandDetail}>
        <code>{result.command.usage}</code>
        <p>{result.command.description}</p>
        {result.command.aliases.length > 0 && <p>别名：/{result.command.aliases.join('、/')}</p>}
      </div>
    );
  }
  return (
    <div className={styles.commandList}>
      {result.commands.map((command) => (
        <div key={command.name} className={styles.commandRow}>
          <code>/{command.name}</code>
          <span>{command.description}</span>
        </div>
      ))}
    </div>
  );
}

function StatusContent({ data }: { data: SlashStatusData }) {
  const contextRatio = data.contextTokens != null && data.contextWindow
    ? Math.min(100, Math.round((data.contextTokens / data.contextWindow) * 100))
    : null;
  return (
    <dl className={styles.statusGrid}>
      <div><dt>模型</dt><dd>{data.providerName} · {data.modelName}</dd></div>
      <div><dt>会话</dt><dd title={data.sessionId}>{data.sessionTitle} · {data.sessionId.slice(0, 8)}</dd></div>
      <div><dt>权限模式</dt><dd>{data.permissionMode}</dd></div>
      <div><dt>会话 Token</dt><dd>{formatTokenCount(data.totalTokens)}</dd></div>
      <div className={styles.contextRow}>
        <dt>上下文窗口</dt>
        <dd>
          {data.contextTokens == null
            ? '暂无可用调用数据'
            : data.contextWindow
              ? `${formatTokenCount(data.contextTokens)} / ${formatTokenCount(data.contextWindow)}（${contextRatio}%）`
              : `${formatTokenCount(data.contextTokens)} / 上限未知`}
        </dd>
        {contextRatio != null && <progress max="100" value={contextRatio} aria-label={`上下文窗口已使用 ${contextRatio}%`} />}
      </div>
    </dl>
  );
}
