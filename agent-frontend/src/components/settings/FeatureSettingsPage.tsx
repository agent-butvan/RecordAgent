import { CalendarDays, Library, NotebookPen, WalletCards } from 'lucide-react';
import type { StudyWindowMode } from '../../types/preferences';
import { Select } from '../common/Select';
import styles from './FeatureSettingsPage.module.css';

export type FeatureSettingsTab = 'calendar' | 'finance' | 'library' | 'record';

const FEATURE_CONTENT: Record<Exclude<FeatureSettingsTab, 'record'>, {
  title: string;
  description: string;
  detail: string;
  icon: typeof CalendarDays;
}> = {
  calendar: {
    title: '日历',
    description: '管理日程、待办和每日信息的展示方式。',
    detail: '当前日历功能使用默认配置。后续新增的提醒、周起始日和日历同步选项会集中在这里。',
    icon: CalendarDays,
  },
  finance: {
    title: '财务',
    description: '管理账户、收支记录和统计展示偏好。',
    detail: '当前财务功能使用默认配置。后续新增的本位币、预算周期和分类规则会集中在这里。',
    icon: WalletCards,
  },
  library: {
    title: '资料',
    description: '管理资料库的编辑、分类和阅读偏好。',
    detail: '当前资料功能使用默认配置。后续新增的默认分类、编辑器和归档选项会集中在这里。',
    icon: Library,
  },
};

interface FeatureSettingsPageProps {
  tab: FeatureSettingsTab;
  studyWindowMode: StudyWindowMode;
  onStudyWindowModeChange: (mode: StudyWindowMode) => void;
}

/** 功能设置统一页面，保持四个业务入口的信息结构与空状态一致。 */
export function FeatureSettingsPage({
  tab,
  studyWindowMode,
  onStudyWindowModeChange,
}: FeatureSettingsPageProps) {
  if (tab === 'record') {
    return (
      <section className={styles.page} aria-labelledby="record-settings-title">
        <header className={styles.header}>
          <span className={styles.icon}><NotebookPen size={18} /></span>
          <div>
            <h1 id="record-settings-title">记录</h1>
            <p>配置学习计时进行中时的展示位置。</p>
          </div>
        </header>

        <div className={styles.settingGroup}>
          <div className={styles.settingCopy}>
            <label htmlFor="study-window-mode">学习小窗</label>
            <p>默认仅在记录页面显示。选择小窗后，每次开始学习都会自动展示。</p>
          </div>
          <Select
            id="study-window-mode"
            fieldSize="md"
            value={studyWindowMode}
            onChange={(event) => onStudyWindowModeChange(event.target.value as StudyWindowMode)}
            options={[
              { label: '仅记录页面', value: 'page' },
              { label: '应用内右下角', value: 'in-app' },
              { label: '系统桌面右下角', value: 'desktop' },
            ]}
          />
        </div>

        <p className={styles.note}>
          应用内小窗和系统小窗均可拖动。关闭或隐藏小窗不会结束当前学习。
        </p>
      </section>
    );
  }

  const content = FEATURE_CONTENT[tab];
  const Icon = content.icon;
  return (
    <section className={styles.page} aria-labelledby={`${tab}-settings-title`}>
      <header className={styles.header}>
        <span className={styles.icon}><Icon size={18} /></span>
        <div>
          <h1 id={`${tab}-settings-title`}>{content.title}</h1>
          <p>{content.description}</p>
        </div>
      </header>
      <div className={styles.emptyState}>
        <strong>当前无需额外配置</strong>
        <p>{content.detail}</p>
      </div>
    </section>
  );
}
