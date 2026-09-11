import {
  Activity, BookOpenText, CalendarClock, CalendarDays, ChartNoAxesColumnIncreasing,
  CircleHelp, GraduationCap, Pencil, Search, WalletCards,
} from 'lucide-react';
import type { SlashCommandDefinition } from '../../features/slash-command/slashCommands';
import styles from './SlashCommandMenu.module.css';

interface SlashCommandMenuProps {
  commands: SlashCommandDefinition[];
  selectedIndex: number;
  onSelect: (command: SlashCommandDefinition) => void;
}

const ICONS = {
  help: CircleHelp,
  rename: Pencil,
  status: Activity,
  tokens: ChartNoAxesColumnIncreasing,
  today: CalendarDays,
  agenda: CalendarClock,
  spending: WalletCards,
  'study-report': GraduationCap,
  'find-record': Search,
  'ask-record': BookOpenText,
} as const;

/** 输入框上方的命令建议列表，键盘焦点始终保留在 textarea。 */
export function SlashCommandMenu({ commands, selectedIndex, onSelect }: SlashCommandMenuProps) {
  if (commands.length === 0) return null;

  return (
    <div id="slash-command-menu" className={styles.menu} role="listbox" aria-label="Slash Command 建议">
      {commands.map((command, index) => {
        const Icon = ICONS[command.name];
        const selected = index === selectedIndex;
        return (
          <button
            key={command.name}
            type="button"
            role="option"
            aria-selected={selected}
            className={`${styles.option} ${selected ? styles.optionSelected : ''}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(command)}
          >
            <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
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
