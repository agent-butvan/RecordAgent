import type { RecordType } from '../../types/record';

/** 系统内置资料类型及统一中文名称。 */
export const RECORD_TYPES: Array<{ value: RecordType; label: string }> = [
  { value: 'quick', label: '随记' },
  { value: 'learning', label: '每日学习' },
  { value: 'weekly_review', label: '每周复盘' },
  { value: 'reading', label: '读书心得' },
  { value: 'journal', label: '每日手记' },
];
