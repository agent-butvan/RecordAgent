import type { SlashCommandDefinition } from '../../features/slash-command/slashCommands';
import { parseSlashCommand } from '../../features/slash-command/slashCommands';
import { SlashCommandIcon } from './SlashCommandIcon';
import styles from './SlashCommandMessage.module.css';

interface SlashCommandMessageProps {
  content: string;
  command: SlashCommandDefinition;
}

interface CommandDetail {
  label: string;
  value: string;
}

/** 对话记录中的 Slash Command 摘要卡片。 */
export function SlashCommandMessage({ content, command }: SlashCommandMessageProps) {
  const parsed = parseSlashCommand(content);
  const details = parsed ? commandDetails(command, parsed.args) : [];

  return (
    <article className={styles.card} aria-label={`Slash Command /${command.name}`}>
      <div className={styles.icon}>
        <SlashCommandIcon command={command.name} size={17} />
      </div>
      <div className={styles.body}>
        <header className={styles.header}>
          <code>/{command.name}</code>
          <span>{command.execution === 'CONTEXT_PROMPT' ? '智能分析' : '快捷命令'}</span>
        </header>
        <p className={styles.description}>{command.description}</p>
        {details.length > 0 && (
          <dl className={styles.details}>
            {details.map((detail) => (
              <div key={`${detail.label}-${detail.value}`}>
                <dt>{detail.label}</dt>
                <dd>{detail.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </article>
  );
}

function commandDetails(command: SlashCommandDefinition, args: string): CommandDetail[] {
  if (!args) return [];

  const leadingMetadata = args.match(/^\[([^\]]+)]\s*(.*)$/s);
  const trailingMetadata = leadingMetadata ? null : args.match(/^(.*?)\s*\[([^\]]+)]\s*$/s);
  const argument = (leadingMetadata?.[2] ?? trailingMetadata?.[1] ?? args).trim();
  const metadata = (leadingMetadata?.[1] ?? trailingMetadata?.[2])?.trim();
  const details: CommandDetail[] = [];

  if (argument) {
    details.push({
      label: command.name === 'study-plan' ? '目标' : command.name === 'ask-record' ? '问题' : '参数',
      value: argument,
    });
  }

  if (metadata?.startsWith('数据：')) {
    const [source, ...scopeParts] = metadata.slice('数据：'.length).split(' · ');
    if (source) details.push({ label: '数据', value: source });
    if (scopeParts.length > 0) details.push({ label: '范围', value: scopeParts.join(' · ') });
  } else if (metadata?.startsWith('资料：')) {
    details.push({ label: '资料', value: metadata.slice('资料：'.length).replaceAll('；资料：', '、') });
  } else if (metadata) {
    details.push({ label: '信息', value: metadata });
  }

  return details;
}
