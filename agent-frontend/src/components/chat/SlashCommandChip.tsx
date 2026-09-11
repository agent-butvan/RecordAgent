import { X } from 'lucide-react';
import type { SlashCommandDefinition } from '../../features/slash-command/slashCommands';
import { SlashCommandIcon } from './SlashCommandIcon';
import styles from './SlashCommandChip.module.css';

interface SlashCommandChipProps {
  command: SlashCommandDefinition;
  onRemove: () => void;
}

/** 输入框内已附加的 Slash Command；移除后保留用户已输入的 Prompt。 */
export function SlashCommandChip({ command, onRemove }: SlashCommandChipProps) {
  return (
    <div className={styles.chip} role="group" aria-label={`已附加命令 /${command.name}`}>
      <SlashCommandIcon command={command.name} size={16} />
      <span>/{command.name}</span>
      <button type="button" onClick={onRemove} aria-label={`移除命令 /${command.name}`}>
        <X size={13} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </div>
  );
}
