import React, { useState, useEffect } from 'react';
import { useModel } from '../../context/ModelContext';
import { fetchSupportedVendors } from '../../services/api';
import {
  ArrowLeft,
  User,
  Settings,
  Sun,
  Mic,
  Sliders,
  Sparkles,
  Keyboard,
  CreditCard,
  Shield,
  Camera,
  Plug,
  Globe,
  Monitor,
  GitBranch,
  FolderArchive,
  Share2,
  Lock,
  Edit2,
  Zap,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  Brain,
  Check
} from 'lucide-react';
import styles from './ModelSettingsPage.module.css';

interface ModelSettingsPageProps {
  onBack: () => void;
}

const VENDOR_DISPLAY_NAMES: Record<string, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  dashscope: '通义千问 (DashScope)',
  deepseek: 'DeepSeek',
  anthropic: 'Anthropic Claude',
  ollama: 'Ollama (Local)',
};

export const ModelSettingsPage: React.FC<ModelSettingsPageProps> = ({ onBack }) => {
  const {
    providers,
    activeProviderId,
    activeModelId,
    selectActiveModel,
    updateProvider,
    addModelToProvider,
    removeModelFromProvider,
    testConnection
  } = useModel();

  const [activeTab, setActiveTab] = useState<string>('config');
  const [supportedVendors, setSupportedVendors] = useState<string[]>(['gemini', 'openai', 'dashscope', 'deepseek', 'anthropic', 'ollama']);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('gemini');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  // 新增模型表单状态
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [newModelDesc, setNewModelDesc] = useState('');
  const [newModelReasoning, setNewModelReasoning] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // 1. 动态从后端 /agent/model/vendors (application-vendor.yml) 拉取支持厂商列表
  useEffect(() => {
    const loadVendors = async () => {
      const vendorList = await fetchSupportedVendors();
      if (vendorList && vendorList.length > 0) {
        setSupportedVendors(vendorList);
        if (!vendorList.includes(selectedProviderId)) {
          setSelectedProviderId(vendorList[0]);
        }
      }
    };
    loadVendors();
  }, []);

  const currentProvider = providers.find((p) => p.id === selectedProviderId) ||
    providers.find((p) => p.type === selectedProviderId) ||
    providers[0];

  const handleTestConnection = async () => {
    if (!currentProvider) return;
    setIsTesting(true);
    setTestResult(null);
    const result = await testConnection(currentProvider.id);
    setTestResult(result);
    setIsTesting(false);
  };

  const handleAddModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelId.trim() || !newModelName.trim() || !currentProvider) return;

    addModelToProvider(currentProvider.id, {
      id: newModelId.trim(),
      name: newModelName.trim(),
      description: newModelDesc.trim() || '自定义配置模型',
      supportsReasoning: newModelReasoning,
    });

    setNewModelId('');
    setNewModelName('');
    setNewModelDesc('');
    setNewModelReasoning(false);
    setShowAddForm(false);
  };

  return (
    <div className={styles.pageContainer}>
      {/* Left Settings Navigation Sidebar */}
      <div className={styles.settingsSidebar}>
        <button className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={15} />
          返回应用
        </button>

        <input
          className={styles.searchInput}
          placeholder="搜索设置..."
        />

        {/* Group 1: 个人 */}
        <div className={styles.navGroup}>
          <div className={styles.groupLabel}>个人</div>
          <button
            className={`${styles.navItem} ${activeTab === 'general' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <Settings size={14} /> 常规
          </button>
          <button
            className={`${styles.navItem} ${activeTab === 'profile' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={14} /> 个人资料
          </button>
          <button
            className={`${styles.navItem} ${activeTab === 'appearance' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            <Sun size={14} /> 外观
          </button>
          <button
            className={`${styles.navItem} ${activeTab === 'voice' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('voice')}
          >
            <Mic size={14} /> 语音
          </button>
          <button
            className={`${styles.navItem} ${activeTab === 'config' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('config')}
          >
            <Sliders size={14} /> 配置 (模型 API Key)
          </button>
          <button
            className={`${styles.navItem} ${activeTab === 'personalize' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('personalize')}
          >
            <Sparkles size={14} /> 个性化
          </button>
          <button
            className={`${styles.navItem} ${activeTab === 'shortcuts' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('shortcuts')}
          >
            <Keyboard size={14} /> 键盘快捷键
          </button>
          <button
            className={`${styles.navItem} ${activeTab === 'billing' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('billing')}
          >
            <CreditCard size={14} /> 使用情况和计费
          </button>
          <button
            className={`${styles.navItem} ${activeTab === 'account' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('account')}
          >
            <Shield size={14} /> 账户
          </button>
        </div>

        {/* Group 2: 集成 */}
        <div className={styles.navGroup}>
          <div className={styles.groupLabel}>集成</div>
          <button className={styles.navItem}><Camera size={14} /> 智能快照</button>
          <button className={styles.navItem}><Plug size={14} /> 插件</button>
          <button className={styles.navItem}><Globe size={14} /> 浏览器</button>
          <button className={styles.navItem}><Monitor size={14} /> 电脑操控</button>
        </div>

        {/* Group 3: 编码 */}
        <div className={styles.navGroup}>
          <div className={styles.groupLabel}>编码</div>
          <button className={styles.navItem}><GitBranch size={14} /> Git与工作树</button>
        </div>

        {/* Group 4: 已归档 */}
        <div className={styles.navGroup}>
          <div className={styles.groupLabel}>已归档</div>
          <button className={styles.navItem}><FolderArchive size={14} /> 已归档任务</button>
        </div>
      </div>

      {/* Right Settings Content Section */}
      <div className={styles.settingsContent}>
        {activeTab === 'profile' && (
          <>
            {/* Header */}
            <div className={styles.topHeader}>
              <h2 className={styles.title}>个人资料</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className={styles.headerBtn}><Share2 size={13} /> 分享</button>
                <button className={styles.headerBtn}><Lock size={13} /> 私有</button>
                <button className={styles.headerBtn}><Edit2 size={13} /> 编辑</button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '20px 0' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#6366f1', color: '#fff', fontSize: '28px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>WJ</div>
              <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '8px' }}>wj</div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>@wangjunzhenshuai · <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Free</span></div>
            </div>
          </>
        )}

        {activeTab === 'config' && (
          <>
            <div className={styles.topHeader}>
              <h2 className={styles.title}>多厂商 AI 模型与 API Key 配置</h2>
            </div>

            {/* Dynamic Vendor Tabs from application-vendor.yml */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {supportedVendors.map((vendorKey) => {
                const displayName = VENDOR_DISPLAY_NAMES[vendorKey] || vendorKey.toUpperCase();
                const isSelected = selectedProviderId === vendorKey;
                return (
                  <button
                    key={vendorKey}
                    className={`${styles.headerBtn} ${isSelected ? styles.navItemActive : ''}`}
                    onClick={() => setSelectedProviderId(vendorKey)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '20px',
                      fontSize: '13px',
                      fontWeight: 600,
                      border: isSelected ? '1.5px solid #6366f1' : '1px solid #e2e8f0',
                      background: isSelected ? '#e0e7ff' : '#f8fafc',
                      color: isSelected ? '#4338ca' : '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    {displayName}
                  </button>
                );
              })}
            </div>

            {currentProvider && (
              <>
                {/* Base URL & API Key */}
                <div className={styles.fieldGroup} style={{ marginBottom: '12px' }}>
                  <label className={styles.label}>Base URL (API Endpoint)</label>
                  <input
                    className={styles.input}
                    value={currentProvider.baseUrl}
                    onChange={(e) => updateProvider(currentProvider.id, { baseUrl: e.target.value })}
                  />
                </div>

                {currentProvider.type !== 'ollama' && (
                  <div className={styles.fieldGroup} style={{ marginBottom: '16px' }}>
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

                <div className={styles.testBar} style={{ marginBottom: '24px' }}>
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

                {/* Models Configured for Current Selected Vendor */}
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px', marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                      {currentProvider.name} 已经配置的模型列表 ({currentProvider.models?.length || 0})
                    </h3>
                    <button
                      onClick={() => setShowAddForm(!showAddForm)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        background: '#fff',
                        fontSize: '12px',
                        cursor: 'pointer',
                        color: '#2563eb',
                        fontWeight: 500
                      }}
                    >
                      <Plus size={13} /> {showAddForm ? '取消添加' : '添加模型'}
                    </button>
                  </div>

                  {/* Add New Model Form */}
                  {showAddForm && (
                    <form onSubmit={handleAddModel} style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', marginBottom: '16px', border: '1px dashed #cbd5e1' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>模型 ID (API Code Name)</label>
                          <input
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                            placeholder="如 gemini-2.5-flash / gpt-4o"
                            value={newModelId}
                            onChange={(e) => setNewModelId(e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>显示名称</label>
                          <input
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                            placeholder="如 Gemini 2.5 Flash"
                            value={newModelName}
                            onChange={(e) => setNewModelName(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>描述说明 (选填)</label>
                        <input
                          style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                          placeholder="模型特性与适用场景说明"
                          value={newModelDesc}
                          onChange={(e) => setNewModelDesc(e.target.value)}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={newModelReasoning}
                            onChange={(e) => setNewModelReasoning(e.target.checked)}
                          />
                          支持逻辑 Reasoning 推理
                        </label>
                        <button
                          type="submit"
                          style={{
                            padding: '6px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            background: '#2563eb',
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: 500,
                            cursor: 'pointer'
                          }}
                        >
                          确定添加
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Configured Models Cards for Selected Vendor */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {currentProvider.models?.map((m) => {
                      const isActive = (currentProvider.id === activeProviderId || currentProvider.type === activeProviderId) && m.id === activeModelId;
                      return (
                        <div
                          key={m.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            borderRadius: '8px',
                            border: isActive ? '1.5px solid #6366f1' : '1px solid #e2e8f0',
                            background: isActive ? '#f5f3ff' : '#ffffff',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '13px' }}>
                              <span>{m.name}</span>
                              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400, background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                                {m.id}
                              </span>
                              {m.supportsReasoning && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '10px', background: '#dbeafe', color: '#1e40af', padding: '1px 5px', borderRadius: '4px' }}>
                                  <Brain size={10} /> 推理
                                </span>
                              )}
                            </div>
                            {m.description && (
                              <span style={{ fontSize: '11px', color: '#64748b' }}>{m.description}</span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isActive ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: '#6366f1' }}>
                                <Check size={14} /> 当前激活
                              </span>
                            ) : (
                              <button
                                onClick={() => selectActiveModel(currentProvider.id, m.id)}
                                style={{
                                  padding: '5px 12px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  background: '#fff',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  color: '#334155'
                                }}
                              >
                                设为当前
                              </button>
                            )}

                            <button
                              onClick={() => removeModelFromProvider(currentProvider.id, m.id)}
                              title="删除模型"
                              style={{
                                padding: '4px 6px',
                                borderRadius: '6px',
                                border: 'none',
                                background: 'transparent',
                                color: '#94a3b8',
                                cursor: 'pointer'
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {activeTab !== 'profile' && activeTab !== 'config' && (
          <div style={{ padding: '40px 0', color: '#64748b' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{activeTab.toUpperCase()} 设置页面</h3>
            <p style={{ marginTop: '8px', fontSize: '13px' }}>包含各种系统的扩展参数配置，当前可在“配置 (模型 API Key)”中调整全量多厂商模型。</p>
          </div>
        )}
      </div>
    </div>
  );
};
