import { BookOpenText, CalendarDays, FileText, GraduationCap, Pencil } from 'lucide-react';
import type { RecordReferenceIconName } from '../../features/record/recordReferencePresentation';

const ICONS = {
  record: BookOpenText,
  note: FileText,
  learning: GraduationCap,
  weekly: CalendarDays,
  reading: BookOpenText,
  journal: Pencil,
} as const;

export function RecordReferenceIcon({ icon, size = 15 }: {
  icon: RecordReferenceIconName;
  size?: number;
}) {
  const Icon = ICONS[icon];
  return <Icon size={size} strokeWidth={1.6} aria-hidden="true" />;
}
