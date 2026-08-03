import React, { useState } from 'react';
import { useModel } from '../../context/ModelContext';
import { X, Eye, EyeOff, ShieldCheck, Zap, Plus, Trash2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import styles from './ModelConfigModal.module.css';

interface ModelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModelConfigModal: React.FC<ModelConfigModalProps> = ({ isOpen, onClose }) => {
  const { providers, updateProvider, testConnection, addModelToProvider, removeModelFromProvider } = useModel();
  const [selectedProviderId, setSelectedProviderId] = useState<string>('deepseek');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  // Form states for adding custom model
  const [newModelName, setNewModelName] = useState('');
  const [newModelId, setNewModelId] = useState('');

  if (!isOpen) return null;

  const currentProvider = providers.find((p) => p.id === selectedProviderId) || providers[0];

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const result = await testConnection(currentProvider.id);
    setTestResult(result);
    setIsTesting(false);
  };

  const handleAddModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelId.trim() || !newModelName.trim()) return;

    addModelToProvider(currentProvider.id, {
      id: newModelId.trim(),
      name: newModelName.trim(),
      description: '自定义添加模型',
    });

    setNewModelId('');
    setNewModelName('');
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>
            <Zap size={18} style={{ color: '#818cf8' }} />
            多厂商 AI 模型与 API Key 配置
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          {/* Provider Sidebar Navigation */}
          <div className={styles.sidebar}>
            {providers.map((p) => {
              const isActive = p.id === selectedProviderId;
              const hasKey = Boolean(p.apiKey) || p.type === 'ollama';
              return (
                <button
                  key={p.id}
                  className={`${styles.providerTab} ${isActive ? styles.providerTabActive : ''}`}
                  onClick={() => {
                    setSelectedProviderId(p.id);
                    setTestResult(null);
                  }}
                >
                  <span>{p.name}</span>
                  {hasKey && <ShieldCheck size={14} style={{ color: '#10b981' }} />}
                </button>
              );
            })}
          </div>

          {/* Provider Form Content */}
          <div className={styles.content}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600 }}>{currentProvider.name} 设置</h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={currentProvider.isEnabled}
                  onChange={(e) => updateProvider(currentProvider.id, { isEnabled: e.target.checked })}
                />
                启用该 Provider
              </label>
            </div>

            {/* Base URL */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Base URL (API Endpoint)</label>
              <input
                className={styles.input}
                type="text"
                value={currentProvider.baseUrl}
                onChange={(e) => updateProvider(currentProvider.id, { baseUrl: e.target.value })}
                placeholder="https://api.example.com/v1"
              />
            </div>

            {/* API Key */}
            {currentProvider.type !== 'ollama' && (
              <div className={styles.fieldGroup}>
                <label className={styles.label}>API Key 密匙</label>
                <div className={styles.inputWrapper}>
                  <input
                    className={styles.input}
                    type={showApiKey ? 'text' : 'password'}
                    value={currentProvider.apiKey}
                    onChange={(e) => updateProvider(currentProvider.id, { apiKey: e.target.value })}
                    placeholder="sk-..."
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* Connection Test */}
            <div className={styles.testBar}>
              <button className={styles.testBtn} onClick={handleTestConnection} disabled={isTesting}>
                {isTesting ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                {isTesting ? '测试中...' : '测试 API 连接'}
              </button>

              {testResult && (
                <div className={`${styles.statusMsg} ${testResult.success ? styles.statusSuccess : styles.statusError}`}>
                  {testResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {testResult.message}
                </div>
              )}
            </div>

            {/* Models list */}
            <div style={{ marginTop: '16px' }}>
              <div className={styles.label} style={{ marginBottom: '8px' }}>可用模型列表</div>
              <div className={styles.modelList}>
                {currentProvider.models.map((m) => (
                  <div key={m.id} className={styles.modelCard}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 500 }}>{m.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {m.id}</div>
                    </div>
                    <button
                      className={styles.closeBtn}
                      onClick={() => removeModelFromProvider(currentProvider.id, m.id)}
                      title="删除此模型"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Custom Model */}
            <form onSubmit={handleAddModel} style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
              <input
                className={styles.input}
                style={{ flex: 1, fontSize: '12px' }}
                placeholder="模型 ID (如 gpt-4o)"
                value={newModelId}
                onChange={(e) => setNewModelId(e.target.value)}
              />
              <input
                className={styles.input}
                style={{ flex: 1, fontSize: '12px' }}
                placeholder="显示名称 (如 GPT-4o)"
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
              />
              <button type="submit" className={styles.testBtn} style={{ padding: '6px 10px' }}>
                <Plus size={14} /> 添加
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
