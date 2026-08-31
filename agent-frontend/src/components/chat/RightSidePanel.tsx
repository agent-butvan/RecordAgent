import React from 'react';
import { PanelRightClose } from 'lucide-react';
import { PanelErrorBoundary } from './PanelErrorBoundary';
import styles from './RightSidePanel.module.css';

export interface RightPanelTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
}

interface RightSidePanelProps {
  open: boolean;
  tabs: RightPanelTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * 可折叠的右侧面板：顶部为内容页签栏（如“任务”“文件”），
 * 最右侧提供收起按钮；内容区由错误边界包裹。
 */
export const RightSidePanel: React.FC<RightSidePanelProps> = ({
  open,
  tabs,
  activeTab,
  onTabChange,
  onClose,
  children,
}) => {
  return (
    <aside
      className={`${styles.panel} ${open ? styles.panelOpen : styles.panelClosed}`}
      aria-hidden={!open}
      aria-label="右侧面板"
      inert={!open}
    >
      <div className={styles.tabBar} role="tablist" aria-label="右侧面板内容">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`${styles.tab} ${active ? styles.tabActive : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <Icon size={14} aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="收起右侧面板"
          title="收起面板"
        >
          <PanelRightClose size={15} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.content} role="tabpanel">
        <PanelErrorBoundary key={activeTab}>{children}</PanelErrorBoundary>
      </div>
    </aside>
  );
};
