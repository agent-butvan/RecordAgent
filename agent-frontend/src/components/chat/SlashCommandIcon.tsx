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
import type { SlashCommandIconName } from '../../features/slash-command/slashCommands';

const ICONS = {
  help: CircleHelp,
  edit: Pencil,
  activity: Activity,
  tokens: ChartNoAxesColumnIncreasing,
  calendar: CalendarDays,
  agenda: CalendarClock,
  finance: WalletCards,
  study: GraduationCap,
  search: Search,
  record: BookOpenText,
} as const;

interface SlashCommandIconProps {
  icon: SlashCommandIconName;
  size?: number;
  strokeWidth?: number;
}

/** Slash Command 在建议菜单与行内标签中共用的图标映射。 */
export function SlashCommandIcon({ icon, size = 15, strokeWidth = 1.6 }: SlashCommandIconProps) {
  const Icon = ICONS[icon];
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" />;
}
