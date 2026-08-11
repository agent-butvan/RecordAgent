import React, { useState, useRef, useEffect } from 'react';
import { useModel } from '../../context/ModelContext';
import { ChevronDown, ChevronRight, ChevronUp, Check } from 'lucide-react';
import styles from './ModelSelector.module.css';

interface ModelSelectorProps {
  onOpenSettings: () => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ onOpenSettings }) => {
  const { activeModelId, selectActiveModel, getActiveModel, getAllModels } = useModel();
  const [isOpen, setIsOpen] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeModel = getActiveModel();
  const allModels = getAllModels();

  // 点击外部收起
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowSubMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectModel = (providerId: string, modelId: string) => {
    selectActiveModel(providerId, modelId);
    setIsOpen(false);
    setShowSubMenu(false);
  };

  const displayModelName = activeModel?.name || '5.6 Terra';

  return (
    <div className={styles.container} ref={dropdownRef}>
      {/* 纯文字模式展示按钮（无圆角边框与背景） */}
      <button
        className={styles.selectorBtn}
        onClick={() => {
          setIsOpen(!isOpen);
          if (isOpen) setShowSubMenu(false);
        }}
        title="点击切换模型"
      >
        <span className={styles.modelMainName}>{displayModelName}</span>
        <ChevronDown size={14} className={styles.chevronIcon} />
      </button>

      {/* 点击后展示的级联弹出菜单 */}
      {isOpen && (
        <div className={styles.cascadingPopover}>
          {/* 左侧主菜单 */}
          <div className={styles.primaryPanel}>
            <button
              className={`${styles.menuItem} ${showSubMenu ? styles.menuItemActive : ''}`}
              onMouseEnter={() => setShowSubMenu(true)}
            >
              <span className={styles.menuItemLabel}>模型</span>
              <span className={styles.menuItemRight}>
                <span>{displayModelName}</span>
                <ChevronRight size={14} />
              </span>
            </button>

            <div className={styles.divider} />

            <button
              className={styles.advancedItem}
              onMouseEnter={() => setShowSubMenu(false)}
              onClick={() => {
                setIsOpen(false);
                setShowSubMenu(false);
                onOpenSettings();
              }}
            >
              <span>高级</span>
              <ChevronUp size={14} />
            </button>
          </div>

          {/* 当鼠标移入“模型”选项时，在右侧悬浮展开模型列表 */}
          {showSubMenu && (
            <div
              className={styles.secondaryPanel}
              onMouseEnter={() => setShowSubMenu(true)}
            >
              {allModels.length === 0 ? (
                <button
                  className={styles.modelOption}
                  onClick={() => {
                    setIsOpen(false);
                    setShowSubMenu(false);
                    onOpenSettings();
                  }}
                >
                  去配置模型...
                </button>
              ) : (
                allModels.map((model) => {
                  const isSelected = model.id === activeModelId;
                  return (
                    <button
                      key={`${model.providerId}-${model.id}`}
                      className={styles.modelOption}
                      onClick={() => handleSelectModel(model.providerId, model.id)}
                    >
                      <span>{model.name}</span>
                      {isSelected && <Check size={14} className={styles.checkIcon} />}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
