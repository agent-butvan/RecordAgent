import type { RecordType } from '../../types/record';

export type RecordReferenceIconName = 'record' | 'note' | 'learning' | 'weekly' | 'reading' | 'journal';

export interface RecordReferencePresentation {
  label: string;
  icon: RecordReferenceIconName;
  color: string;
  borderColor: string;
  backgroundColor: string;
}

/** 不同资料类型独立声明显示名称、图标与颜色。 */
export const RECORD_REFERENCE_PRESENTATIONS: Record<RecordType, RecordReferencePresentation> = {
  quick: {
    label: '随记', icon: 'note', color: '#596579', borderColor: '#dce1e8', backgroundColor: '#f8f9fb',
  },
  learning: {
    label: '每日学习', icon: 'learning', color: '#7657b6', borderColor: '#e1d9f0', backgroundColor: '#faf8fd',
  },
  weekly_review: {
    label: '每周复盘', icon: 'weekly', color: '#5364bb', borderColor: '#dbe0f3', backgroundColor: '#f8f9fe',
  },
  reading: {
    label: '读书心得', icon: 'reading', color: '#3267b1', borderColor: '#d9e5f4', backgroundColor: '#f7faff',
  },
  journal: {
    label: '每日手记', icon: 'journal', color: '#39766f', borderColor: '#d8e8e5', backgroundColor: '#f7fbfa',
  },
};

/** 旧会话只保存资料标题时使用的兼容显示配置。 */
export const GENERIC_RECORD_REFERENCE_PRESENTATION: RecordReferencePresentation = {
  label: '引用资料',
  icon: 'record',
  color: '#3267b1',
  borderColor: '#d9e5f4',
  backgroundColor: '#f7faff',
};
