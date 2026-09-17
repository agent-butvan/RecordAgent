import type { ChatTopBarPreferences, StudyWindowMode } from '../../types/preferences';
import { Select } from '../common/Select';
import { LeverSwitch } from '../common/LeverSwitch';
import { SettingsPageLayout } from './SettingsPageLayout';
import styles from './FeatureSettingsPage.module.css';

export type FeatureSettingsTab = 'calendar' | 'finance' | 'library' | 'record';

const FEATURE_CONTENT: Record<Exclude<FeatureSettingsTab, 'record'>, {
  title: string;
  description: string;
  detail: string;
}> = {
  calendar: {
    title: '日历',
    description: '管理日程、待办和每日信息的展示方式。',
    detail: '当前日历功能使用默认配置。后续新增的提醒、周起始日和日历同步选项会集中在这里。',
  },
  finance: {
    title: '财务',
    description: '管理账户、收支记录和统计展示偏好。',
    detail: '当前财务功能使用默认配置。后续新增的本位币、预算周期和分类规则会集中在这里。',
  },
  library: {
    title: '资料',
    description: '管理资料库的编辑、分类和阅读偏好。',
    detail: '当前资料功能使用默认配置。后续新增的默认分类、编辑器和归档选项会集中在这里。',
  },
};

interface FeatureSettingsPageProps {
  tab: FeatureSettingsTab;
  studyWindowMode: StudyWindowMode;
  onStudyWindowModeChange: (mode: StudyWindowMode) => void;
  chatTopBar: ChatTopBarPreferences;
  onChatTopBarChange: (key: keyof ChatTopBarPreferences, visible: boolean) => void;
}

/** 功能设置统一页面，保持四个业务入口的信息结构与空状态一致。 */
export function FeatureSettingsPage({
  tab,
  studyWindowMode,
  onStudyWindowModeChange,
  chatTopBar,
  onChatTopBarChange,
}: FeatureSettingsPageProps) {
  if (tab === 'record') {
    return (
      <SettingsPageLayout title="记录" description="">
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
          应用内小窗和系统小窗均可在非按钮区域拖动，并可从右下角调整大小。关闭或隐藏小窗不会结束当前学习。
        </p>
      </SettingsPageLayout>
    );
  }

  if (tab === 'calendar') {
    return (
      <SettingsPageLayout title="日历" description={FEATURE_CONTENT.calendar.description}>
        <SettingToggle
          label="在聊天顶栏显示日期"
          description="显示今天的日期和星期，点击后展开完整日期信息。"
          checked={chatTopBar.showDate}
          onChange={(checked) => onChatTopBarChange('showDate', checked)}
        />
        <SettingToggle
          label="在聊天顶栏显示待办"
          description="显示今日待办完成情况，点击后查看接下来要处理的事项。"
          checked={chatTopBar.showTodos}
          onChange={(checked) => onChatTopBarChange('showTodos', checked)}
        />
      </SettingsPageLayout>
    );
  }

  if (tab === 'finance') {
    return (
      <SettingsPageLayout title="财务" description={FEATURE_CONTENT.finance.description}>
        <SettingToggle
          label="在聊天顶栏显示财务摘要"
          description="显示今日收入和支出，点击后查看本月汇总与最近流水。"
          checked={chatTopBar.showFinance}
          onChange={(checked) => onChatTopBarChange('showFinance', checked)}
        />
      </SettingsPageLayout>
    );
  }

  const content = FEATURE_CONTENT[tab];
  return (
    <SettingsPageLayout title={content.title} description={content.description}>
      <div className={styles.emptyState}>
        <strong>当前无需额外配置</strong>
        <p>{content.detail}</p>
      </div>
    </SettingsPageLayout>
  );
}

function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className={styles.settingGroup}>
      <div className={styles.settingCopy}>
        <span className={styles.settingLabel}>{label}</span>
        <p>{description}</p>
      </div>
      <LeverSwitch checked={checked} onChange={onChange} label={label} showLabel={false} />
    </div>
  );
}
