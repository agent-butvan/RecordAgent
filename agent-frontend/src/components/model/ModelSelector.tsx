import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useModel } from '../../context/ModelContext';
import { ChevronDown, Settings, Check } from 'lucide-react';
import styles from './ModelSelector.module.css';

interface ModelSelectorProps {
  onOpenSettings: () => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ onOpenSettings }) => {
  const { activeProviderId, activeModelId, selectActiveModel, getActiveModel, getActiveProvider, getAllModels } = useModel();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeProvider = getActiveProvider();
  const activeModel = getActiveModel();
  const allModels = getAllModels();

  type ModelItemType = ReturnType<typeof getAllModels>[number];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 按 Vendor 厂商对模型进行分类分组
  const groupedModels = useMemo(() => {
    const groups: Record<string, { vendorName: string; models: ModelItemType[] }> = {};


    allModels.forEach((model) => {
      const vendorKey = model.providerType || model.providerId || 'other';
      const vendorName = (model.providerName || vendorKey).toUpperCase();

      if (!groups[vendorKey]) {
        groups[vendorKey] = {
          vendorName,
          models: [],
        };
      }
      groups[vendorKey].models.push(model);
    });

    return Object.values(groups);
  }, [allModels]);

  const handleSelectModel = (providerId: string, modelId: string) => {
    selectActiveModel(providerId, modelId);
    setIsOpen(false);
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      {/* 当前选中的模型触发按钮 */}
      <button 
        className={styles.selectorBtn} 
        onClick={() => setIsOpen(!isOpen)}
        title="点击选择模型"
      >
        <span className={styles.activeVendorLabel}>
          {activeProvider ? (activeProvider.name || activeProvider.type.toUpperCase()) : '模型'}
        </span>
        <span className={styles.activeModelName}>{activeModel?.name || '选择模型'}</span>
        <ChevronDown size={13} style={{ opacity: 0.7, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
      </button>

      {/* 点击配置按钮 */}
      <button 
        className={styles.configBtn}
        onClick={onOpenSettings}
        title="模型厂商与 API Key 配置"
      >
        <Settings size={14} />
      </button>

      {/* 向上弹出的极简模型选择下拉菜单 */}
      {isOpen && (
        <div className={styles.dropdown}>
          {allModels.length === 0 ? (
            <button
              className={styles.emptyOption}
              onClick={() => {
                setIsOpen(false);
                onOpenSettings();
              }}
            >
              暂未配置任何模型，点击去设置
            </button>
          ) : (
            groupedModels.map((group) => (
              <div key={group.vendorName} className={styles.vendorGroup}>
                <div className={styles.vendorHeader}>{group.vendorName}</div>
                {group.models.map((model) => {
                  const isSelected =
                    (model.providerId === activeProviderId || model.providerType === activeProviderId) &&
                    model.id === activeModelId;

                  return (
                    <button
                      key={`${model.providerId}-${model.id}`}
                      className={`${styles.modelOption} ${isSelected ? styles.modelOptionActive : ''}`}
                      onClick={() => handleSelectModel(model.providerId, model.id)}
                    >
                      <span className={styles.modelOptionName}>{model.name}</span>
                      {isSelected && <Check size={14} className={styles.checkIcon} />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
