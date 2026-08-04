import React, { useState, useRef, useEffect } from 'react';
import { useModel } from '../../context/ModelContext';
import { ChevronDown, Settings, Brain, Check } from 'lucide-react';
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

  const handleSelectModel = (providerId: string, modelId: string) => {
    selectActiveModel(providerId, modelId);
    setIsOpen(false);
  };

  const getProviderClass = (type: string) => {
    switch (type) {
      case 'gemini': return styles.gemini;
      case 'deepseek': return styles.deepseek;
      case 'openai': return styles.openai;
      case 'anthropic': return styles.anthropic;
      case 'ollama': return styles.ollama;
      case 'qwen': return styles.qwen;
      default: return styles.gemini;
    }
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button 
        className={styles.selectorBtn} 
        onClick={() => setIsOpen(!isOpen)}
        title="切换当前 Agent 使用的 AI 大模型"
      >
        <span className={`${styles.providerBadge} ${getProviderClass(activeProvider?.type || 'gemini')}`}>
          {activeProvider ? (activeProvider.name || activeProvider.type.toUpperCase()) : '未配置'}
        </span>
        <span>{activeModel?.name || '选择模型'}</span>
        {activeModel?.supportsReasoning && (
          <span className={styles.reasoningBadge}>
            <Brain size={10} /> 推理
          </span>
        )}
        <ChevronDown size={14} style={{ opacity: 0.7, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
      </button>

      <button 
        className={styles.configBtn}
        onClick={onOpenSettings}
        title="模型厂商与 API Key 配置"
      >
        <Settings size={15} />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          {allModels.length === 0 ? (
            <button
              className={styles.modelOption}
              onClick={() => {
                setIsOpen(false);
                onOpenSettings();
              }}
              style={{ color: '#6366f1', fontWeight: 500, justifyContent: 'center', padding: '12px' }}
            >
              暂未配置任何模型，点击去设置
            </button>
          ) : (
            allModels.map((model) => {
              const isSelected = (model.providerId === activeProviderId || model.providerType === activeProviderId) && model.id === activeModelId;
              return (
                <button
                  key={`${model.providerId}-${model.id}`}
                  className={`${styles.modelOption} ${isSelected ? styles.modelOptionActive : ''}`}
                  onClick={() => handleSelectModel(model.providerId, model.id)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                      <span className={`${styles.providerBadge} ${getProviderClass(model.providerType)}`} style={{ fontSize: '10px', padding: '1px 4px' }}>
                        {model.providerName || model.providerType.toUpperCase()}
                      </span>
                      <span>{model.name}</span>
                      {model.supportsReasoning && (
                        <span className={styles.reasoningBadge} style={{ fontSize: '9px' }}>
                          <Brain size={9} /> 推理
                        </span>
                      )}
                    </div>
                    {model.description && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {model.description}
                      </span>
                    )}
                  </div>
                  {isSelected && <Check size={14} style={{ color: '#818cf8', flexShrink: 0 }} />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
