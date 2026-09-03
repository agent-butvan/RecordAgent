import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { PanelErrorBoundary } from './PanelErrorBoundary';
import styles from './RightSidePanel.module.css';

export interface RightPanelTab {
  id: string;
  label: string;
  icon: React.ComponentType<{
    size?: number | string;
    className?: string;
    'aria-hidden'?: React.AriaAttributes['aria-hidden'];
  }>;
}

interface RightSidePanelProps {
  open: boolean;
  availableTabs: RightPanelTab[];
  tabs: RightPanelTab[];
  activeTab: string | null;
  onTabChange: (tabId: string) => void;
  onOpenTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  children: React.ReactNode;
}

/**
 * 浏览器式右侧工作面板：支持从功能选择页新建、切换和关闭标签。
 */
export const RightSidePanel: React.FC<RightSidePanelProps> = ({
  open,
  availableTabs,
  tabs,
  activeTab,
  onTabChange,
  onOpenTab,
  onCloseTab,
  children,
}) => {
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (open && tabs.length === 0) setShowPicker(true);
  }, [open, tabs.length]);

  const selectFeature = (tabId: string) => {
    onOpenTab(tabId);
    setShowPicker(false);
  };

  const handleTabKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + offset + tabs.length) % tabs.length;
    onTabChange(tabs[nextIndex].id);
    const tabButtons = event.currentTarget
      .closest('[role="tablist"]')
      ?.querySelectorAll<HTMLElement>('[role="tab"]');
    tabButtons?.[nextIndex]?.focus();
  };

  const pickerVisible = showPicker || !activeTab;

  return (
    <aside
      className={`${styles.panel} ${open ? styles.panelOpen : styles.panelClosed}`}
      aria-hidden={!open}
      aria-label="右侧面板"
      inert={!open}
    >
      {tabs.length > 0 && (
        <div className={styles.tabBar}>
          <div className={styles.tabsScroll} role="tablist" aria-label="右侧面板标签">
            {tabs.map((tab, index) => {
              const Icon = tab.icon;
              const active = tab.id === activeTab && !pickerVisible;
              return (
                <div
                  key={tab.id}
                  className={`${styles.tabShell} ${active ? styles.tabShellActive : ''}`}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls="right-panel-content"
                    tabIndex={active ? 0 : -1}
                    className={styles.tab}
                    onClick={() => {
                      onTabChange(tab.id);
                      setShowPicker(false);
                    }}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                  >
                    <Icon size={14} aria-hidden="true" />
                    <span>{tab.label}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.closeTabBtn}
                    onClick={() => onCloseTab(tab.id)}
                    aria-label={`关闭${tab.label}标签`}
                    title={`关闭${tab.label}`}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              role="tab"
              aria-selected={pickerVisible}
              aria-controls="right-panel-content"
              tabIndex={pickerVisible ? 0 : -1}
              className={`${styles.newTabBtn} ${pickerVisible ? styles.newTabBtnActive : ''}`}
              onClick={() => setShowPicker(true)}
              aria-label="新建功能标签"
              title="新建标签"
            >
              <Plus size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
      <div id="right-panel-content" className={styles.content} role="tabpanel">
        {pickerVisible ? (
          <div className={styles.featurePicker}>
            <div className={styles.featureList}>
              {availableTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={styles.featureOption}
                    onClick={() => selectFeature(tab.id)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <PanelErrorBoundary key={activeTab}>{children}</PanelErrorBoundary>
        )}
      </div>
    </aside>
  );
};
