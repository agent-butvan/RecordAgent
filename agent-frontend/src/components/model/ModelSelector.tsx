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
  const [activeTab, setActiveTab] = useState<'model' | 'reasoning'>('model');
  const [reasoningLevel, setReasoningLevel] = useState<string>('轻度');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeModel = getActiveModel();
  const allModels = getAllModels();

  // 点击外部收起
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectModel = (providerId: string, modelId: string) => {
    selectActiveModel(providerId, modelId);
  };

  const handleSelectReasoning = (level: string) => {
    setReasoningLevel(level);
  };

  const displayModelName = activeModel?.name || '5.6 Terra';

  return (
    <div className={styles.container} ref={dropdownRef}>
      {/* 图 2: 极简胶囊展示按钮 */}
      <button
        className={styles.selectorBtn}
        onClick={() => setIsOpen(!isOpen)}
        title="模型与推理强度配置"
      >
        <span className={styles.modelMainName}>{displayModelName}</span>
        <span className={styles.modelSubDetail}>{reasoningLevel}</span>
        <ChevronDown size={14} className={styles.chevronIcon} />
      </button>

      {/* 图 3: 级联弹出菜单 */}
      {isOpen && (
        <div className={styles.cascadingPopover}>
          {/* 左侧主设置项 */}
          <div className={styles.primaryPanel}>
            <button
              className={`${styles.menuItem} ${activeTab === 'model' ? styles.menuItemActive : ''}`}
              onClick={() => setActiveTab('model')}
            >
              <span className={styles.menuItemLabel}>模型</span>
              <span className={styles.menuItemRight}>
                <span>{displayModelName}</span>
                <ChevronRight size={14} />
              </span>
            </button>

            <button
              className={`${styles.menuItem} ${activeTab === 'reasoning' ? styles.menuItemActive : ''}`}
              onClick={() => setActiveTab('reasoning')}
            >
              <span className={styles.menuItemLabel}>推理强度</span>
              <span className={styles.menuItemRight}>
                <span>{reasoningLevel}</span>
                <ChevronRight size={14} />
              </span>
            </button>

            <div className={styles.divider} />

            <button className={styles.advancedItem} onClick={onOpenSettings}>
              <span>高级</span>
              <ChevronUp size={14} />
            </button>
          </div>

          {/* 右侧二级字列表 */}
          <div className={styles.secondaryPanel}>
            {activeTab === 'model' ? (
              allModels.length === 0 ? (
                <button className={styles.modelOption} onClick={onOpenSettings}>
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
              )
            ) : (
              ['轻度', '中度', '深度', '关闭'].map((level) => {
                const isSelected = level === reasoningLevel;
                return (
                  <button
                    key={level}
                    className={styles.modelOption}
                    onClick={() => handleSelectReasoning(level)}
                  >
                    <span>{level}</span>
                    {isSelected && <Check size={14} className={styles.checkIcon} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
