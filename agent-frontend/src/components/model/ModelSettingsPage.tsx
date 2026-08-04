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
  Plus,
  Trash2,
  Brain,
  Zap,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Inbox
} from 'lucide-react';
import styles from './ModelSettingsPage.module.css';

interface ModelSettingsPageProps {
  onBack: () => void;
}

const VENDOR_DEFAULT_URLS: Record<string, string> = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  deepseek: 'https://api.deepseek.com/v1',
  openai: 'https://api.openai.com/v1',
  dashscope: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  anthropic: 'https://api.anthropic.com/v1',
  ollama: 'http://localhost:11434/v1',
};

const VENDOR_DISPLAY_NAMES: Record<string, string> = {
  gemini: 'Google Gemini',
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  dashscope: '通义千问 (DashScope)',
  anthropic: 'Anthropic Claude',
  ollama: 'Ollama (Local)',
};

export const ModelSettingsPage: React.FC<ModelSettingsPageProps> = ({ onBack }) => {
  const {
    activeProviderId,
    activeModelId,
    selectActiveModel,
    addModelItem,
    deleteModelItem,
    testConnectionByUrl,
    getAllModels
  } = useModel();

  const [activeTab, setActiveTab] = useState<string>('config');
  const [supportedVendors, setSupportedVendors] = useState<string[]>(['gemini', 'openai', 'dashscope', 'deepseek', 'anthropic', 'ollama']);
  
  // 所有目前在 config.json 中真实配置的模型列表
  const allModels = getAllModels();

  // 展开表单 / 模态状态
  const [showAddForm, setShowAddForm] = useState(false);
  const [formVendor, setFormVendor] = useState('gemini');
  const [formBaseUrl, setFormBaseUrl] = useState(VENDOR_DEFAULT_URLS.gemini);
  const [formApiKey, setFormApiKey] = useState('');
  const [formModelId, setFormModelId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formReasoning, setFormReasoning] = useState(false);
  const [showApiKeyMask, setShowApiKeyMask] = useState<Record<string, boolean>>({});

  // 连接测试结果 map
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [testingMap, setTestingMap] = useState<Record<string, boolean>>({});

  // 1. 动态从后端 /agent/model/vendors (application-vendor.yml) 拉取支持厂商列表
  useEffect(() => {
    const loadVendors = async () => {
      const vendorList = await fetchSupportedVendors();
      if (vendorList && vendorList.length > 0) {
        setSupportedVendors(vendorList);
        if (!vendorList.includes(formVendor)) {
          setFormVendor(vendorList[0]);
          setFormBaseUrl(VENDOR_DEFAULT_URLS[vendorList[0]] || '');
        }
      }
    };
    loadVendors();
  }, []);

  const handleVendorChange = (v: string) => {
    setFormVendor(v);
    if (VENDOR_DEFAULT_URLS[v]) {
      setFormBaseUrl(VENDOR_DEFAULT_URLS[v]);
    }
  };

  const handleSaveModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formModelId.trim() || !formName.trim()) return;

    addModelItem({
      vendor: formVendor,
      baseUrl: formBaseUrl.trim(),
      apiKey: formApiKey.trim(),
      modelId: formModelId.trim(),
      name: formName.trim(),
      description: formDesc.trim(),
      supportsReasoning: formReasoning,
    });

    setFormModelId('');
    setFormName('');
    setFormDesc('');
    setFormReasoning(false);
    setShowAddForm(false);
  };

  const handleTestItem = async (modelItem: any) => {
    const key = `${modelItem.providerId}-${modelItem.id}`;
    setTestingMap((prev) => ({ ...prev, [key]: true }));

    const res = await testConnectionByUrl(modelItem.baseUrl, modelItem.apiKey, modelItem.providerType);
    setTestResults((prev) => ({ ...prev, [key]: res }));
    setTestingMap((prev) => ({ ...prev, [key]: false }));
  };

  const toggleMask = (key: string) => {
    setShowApiKeyMask((prev) => ({ ...prev, [key]: !prev[key] }));
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
        {activeTab === 'config' && (
          <>
            <div className={styles.topHeader}>
              <div>
                <h2 className={styles.title}>模型配置列表 (Model List)</h2>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  托管在本地 ~/.butvan-agent/config.json 的多厂商 AI 大模型配置
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', color: '#475569', background: '#f1f5f9', padding: '6px 12px', borderRadius: '20px', fontWeight: 500 }}>
                  已配置模型: <strong>{allModels.length}</strong> 个
                </span>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  <Plus size={15} /> {showAddForm ? '取消添加' : '新增配置模型'}
                </button>
              </div>
            </div>

            {/* Inline Add Model Form Card - 精简至仅包含【模型供应商】、【模型名称】与【API Key】 3 项 */}
            {showAddForm && (
              <form onSubmit={handleSaveModel} style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #cbd5e1', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: '#0f172a' }}>
                  新增 AI 大模型配置
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label className={styles.label}>模型供应商</label>
                    <select
                      className={styles.input}
                      value={formVendor}
                      onChange={(e) => handleVendorChange(e.target.value)}
                    >
                      {supportedVendors.map((v) => (
                        <option key={v} value={v}>
                          {VENDOR_DISPLAY_NAMES[v] || v.toUpperCase()} ({v})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={styles.label}>模型名称</label>
                    <input
                      className={styles.input}
                      value={formName}
                      onChange={(e) => {
                        setFormName(e.target.value);
                        setFormModelId(e.target.value);
                      }}
                      placeholder="例如 gemini-2.5-flash / deepseek-chat"
                      required
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label className={styles.label}>API Key 密钥</label>
                  <input
                    className={styles.input}
                    type="password"
                    value={formApiKey}
                    onChange={(e) => setFormApiKey(e.target.value)}
                    placeholder={formVendor === 'ollama' ? 'Ollama 本地无需 API Key (选填)' : 'sk-... / AIza...'}
                    required={formVendor !== 'ollama'}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '8px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#2563eb',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    保存配置模型
                  </button>
                </div>
              </form>
            )}

            {/* EMPTY STATE: config.json 中没有任何配置的模型时 */}
            {allModels.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                borderRadius: '16px',
                border: '2px dashed #e2e8f0',
                background: '#fafafa',
                textAlign: 'center',
                margin: '20px 0'
              }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <Inbox size={32} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: '0 0 6px' }}>
                  暂未配置任何 AI 大模型
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '440px', lineHeight: 1.5, margin: '0 0 20px' }}>
                  本地配置文件 <code>~/.butvan-agent/config.json</code> 当前无任何有效模型。请点击下方按钮添加您的第一个 Gemini、DeepSeek 或 OpenAI 模型。
                </p>
                <button
                  onClick={() => setShowAddForm(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={16} /> 新增配置模型
                </button>
              </div>
            ) : (
              /* REAL MODEL LIST CARDS FROM config.json */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {allModels.map((item) => {
                  const key = `${item.providerId}-${item.id}`;
                  const isActive = (item.providerId === activeProviderId || item.providerType === activeProviderId) && item.id === activeModelId;
                  const isMasked = !showApiKeyMask[key];
                  const testRes = testResults[key];
                  const isTesting = !!testingMap[key];

                  return (
                    <div
                      key={key}
                      style={{
                        padding: '16px 20px',
                        borderRadius: '12px',
                        border: isActive ? '2px solid #6366f1' : '1px solid #e2e8f0',
                        background: isActive ? '#f5f3ff' : '#ffffff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* Top Header Row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: '#312e81',
                            color: '#ffffff',
                            fontSize: '11px',
                            fontWeight: 700,
                            letterSpacing: '0.5px'
                          }}>
                            {(VENDOR_DISPLAY_NAMES[item.providerType] || item.providerName || 'VENDOR').toUpperCase()}
                          </span>

                          <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                            {item.name}
                          </span>

                          <span style={{ fontSize: '12px', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                            {item.id}
                          </span>

                          {item.supportsReasoning && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              <Brain size={11} /> 推理
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {isActive ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 700, color: '#6366f1' }}>
                              <CheckCircle2 size={16} /> 当前激活
                            </span>
                          ) : (
                            <button
                              onClick={() => selectActiveModel(item.providerId, item.id)}
                              style={{
                                padding: '5px 12px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                fontSize: '12px',
                                cursor: 'pointer',
                                color: '#334155',
                                fontWeight: 500
                              }}
                            >
                              设为当前
                            </button>
                          )}

                          <button
                            onClick={() => deleteModelItem(item.providerId, item.id)}
                            title="删除模型"
                            style={{
                              padding: '5px 8px',
                              borderRadius: '6px',
                              border: 'none',
                              background: 'transparent',
                              color: '#94a3b8',
                              cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {item.description && (
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                          {item.description}
                        </div>
                      )}

                      {/* Details Row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#475569', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px' }}>
                        {item.providerType !== 'ollama' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <strong>API Key:</strong>
                            <code>
                              {item.apiKey
                                ? isMasked
                                  ? `${item.apiKey.substring(0, 4)}...${item.apiKey.substring(Math.max(0, item.apiKey.length - 4))}`
                                  : item.apiKey
                                : '未填写'}
                            </code>
                            <button
                              onClick={() => toggleMask(key)}
                              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                            >
                              {isMasked ? <Eye size={13} /> : <EyeOff size={13} />}
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            Ollama 本地开放服务
                          </div>
                        )}

                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={() => handleTestItem(item)}
                            disabled={isTesting}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                              background: '#fff',
                              fontSize: '11px',
                              cursor: 'pointer'
                            }}
                          >
                            {isTesting ? <RefreshCw size={11} className="animate-spin" /> : <Zap size={11} />}
                            测试连接
                          </button>

                          {testRes && (
                            <span style={{ fontSize: '11px', color: testRes.success ? '#047857' : '#b91c1c', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              {testRes.success ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                              {testRes.message}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab !== 'config' && (
          <div style={{ padding: '40px 0', color: '#64748b' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{activeTab.toUpperCase()} 设置页面</h3>
            <p style={{ marginTop: '8px', fontSize: '13px' }}>可在“配置 (模型 API Key)”中查看与修改您的 Model List。</p>
          </div>
        )}
      </div>
    </div>
  );
};
