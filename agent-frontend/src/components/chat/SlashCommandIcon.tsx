import {
  Activity,
  BookOpenText,
  CalendarClock,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  CircleHelp,
  GraduationCap,
  Pencil,
  Search,
  WalletCards,
} from 'lucide-react';
import type { SlashCommandName } from '../../features/slash-command/slashCommands';

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
  'summarize-record': BookOpenText,
  'compare-records': BookOpenText,
  'daily-review': CalendarDays,
  'weekly-review': CalendarDays,
  'todo-review': CalendarClock,
  'finance-review': WalletCards,
  'study-review': GraduationCap,
  'study-plan': GraduationCap,
} as const;

interface SlashCommandIconProps {
  command: SlashCommandName;
  size?: number;
  strokeWidth?: number;
}

/** Slash Command 在菜单与消息卡片中共用的图标映射。 */
export function SlashCommandIcon({ command, size = 15, strokeWidth = 1.6 }: SlashCommandIconProps) {
  const Icon = ICONS[command];
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" />;
}
