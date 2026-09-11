import { useEffect, useRef, type CSSProperties } from 'react';
import type { SlashCommandDefinition } from '../../features/slash-command/slashCommands';
import { SlashCommandIcon } from './SlashCommandIcon';
import styles from './SlashCommandMenu.module.css';

interface SlashCommandMenuProps {
  commands: SlashCommandDefinition[];
  selectedIndex: number;
  onSelect: (command: SlashCommandDefinition) => void;
}

/** 输入框上方的命令建议列表，键盘焦点始终保留在 textarea。 */
export function SlashCommandMenu({ commands, selectedIndex, onSelect }: SlashCommandMenuProps) {
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (commands.length === 0) return null;

  return (
    <div id="slash-command-menu" className={styles.menu} role="listbox" aria-label="Slash Command 建议">
      {commands.map((command, index) => {
        const selected = index === selectedIndex;
        return (
          <button
            key={command.name}
            ref={selected ? selectedRef : undefined}
            type="button"
            role="option"
            aria-selected={selected}
            className={`${styles.option} ${selected ? styles.optionSelected : ''}`}
            style={{ '--command-color': command.presentation.color } as CSSProperties}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(command)}
          >
            <span className={styles.iconWrap} aria-hidden="true">
              <SlashCommandIcon icon={command.presentation.icon} />
            </span>
            <span className={styles.name}>/{command.name}</span>
            <span className={styles.description}>{command.description}</span>
            {command.aliases.length > 0 && (
              <span className={styles.alias}>/{command.aliases.join(' · /')}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
