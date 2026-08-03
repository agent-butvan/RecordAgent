import React, { useState } from 'react';
import { useModel } from '../../context/ModelContext';
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
  RefreshCw
} from 'lucide-react';
import styles from './ModelConfigModal.module.css';

interface ModelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModelConfigModal: React.FC<ModelConfigModalProps> = ({ isOpen, onClose }) => {
  const { providers, updateProvider, testConnection } = useModel();
  const [activeTab, setActiveTab] = useState<string>('profile');
  const [selectedProviderId, setSelectedProviderId] = useState<string>('deepseek');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentProvider = providers.find((p) => p.id === selectedProviderId) || providers[0];

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const result = await testConnection(currentProvider.id);
    setTestResult(result);
    setIsTesting(false);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Left Settings Navigation Sidebar matching Image 2 */}
        <div className={styles.settingsSidebar}>
          <button className={styles.backBtn} onClick={onClose}>
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
                <div className={styles.headerActions}>
                  <button className={styles.headerBtn}><Share2 size={13} /> 分享</button>
                  <button className={styles.headerBtn}><Lock size={13} /> 私有</button>
                  <button className={styles.headerBtn}><Edit2 size={13} /> 编辑</button>
                </div>
              </div>

              {/* Big Profile Avatar */}
              <div className={styles.profileSection}>
                <div className={styles.bigAvatar}>WJ</div>
                <div className={styles.userName}>wj</div>
                <div className={styles.userHandle}>
                  @wangjunzhenshuai · <span className={styles.badgeFree}>Free</span>
                </div>
              </div>

              {/* Stats Metrics Cards matching Image 2 */}
              <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                  <div className={styles.statVal}>2.4亿</div>
                  <div className={styles.statLbl}>累计 Token 数</div>
                </div>
                <div className={styles.statItem}>
                  <div className={styles.statVal}>2744.1万</div>
                  <div className={styles.statLbl}>峰值 Token 数</div>
                </div>
                <div className={styles.statItem}>
                  <div className={styles.statVal}>23分1秒</div>
                  <div className={styles.statLbl}>最长任务时长</div>
                </div>
                <div className={styles.statItem}>
                  <div className={styles.statVal}>0天</div>
                  <div className={styles.statLbl}>当前连续天数</div>
                </div>
                <div className={styles.statItem}>
                  <div className={styles.statVal}>11天</div>
                  <div className={styles.statLbl}>最长连续天数</div>
                </div>
              </div>

              {/* Heatmap Grid */}
              <div className={styles.heatmapSection}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}>Token 活动</div>
                  <div className={styles.timeFilter}>
                    <span>每日</span>
                    <span>每周</span>
                    <span className={styles.timeFilterActive}>累计</span>
                  </div>
                </div>

                <div className={styles.heatGrid}>
                  {Array.from({ length: 144 }).map((_, i) => {
                    const rand = i % 7 === 0 ? styles.c3 : i % 5 === 0 ? styles.c2 : i % 11 === 0 ? styles.c4 : i % 3 === 0 ? styles.c1 : '';
                    return <div key={i} className={`${styles.cell} ${rand}`} />;
                  })}
                </div>
              </div>

              {/* Bottom Two Columns */}
              <div className={styles.bottomTwoCols}>
                <div>
                  <div className={styles.sectionTitle} style={{ marginBottom: '8px' }}>活动洞察</div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoKey}>快速模式</span>
                    <span className={styles.infoVal}>未使用</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoKey}>最常用的推理强度</span>
                    <span className={styles.infoVal}>中 · 65%</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoKey}>已探索的技能</span>
                    <span className={styles.infoVal}>15</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoKey}>使用的技能总数</span>
                    <span className={styles.infoVal}>63</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoKey}>任务总数</span>
                    <span className={styles.infoVal}>141</span>
                  </div>
                </div>

                <div>
                  <div className={styles.sectionTitle} style={{ marginBottom: '8px' }}>最常用的插件</div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoKey}>$imagegen</span>
                    <span className={styles.infoVal}>19 次运行</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoKey}>@presentations</span>
                    <span className={styles.infoVal}>14 次运行</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoKey}>@browser</span>
                    <span className={styles.infoVal}>6 次运行</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoKey}>@documents</span>
                    <span className={styles.infoVal}>5 次运行</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoKey}>@computer-use</span>
                    <span className={styles.infoVal}>4 次运行</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'config' && (
            <>
              <div className={styles.topHeader}>
                <h2 className={styles.title}>多厂商 AI 模型与 API Key 配置</h2>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                {providers.map((p) => (
                  <button
                    key={p.id}
                    className={`${styles.headerBtn} ${selectedProviderId === p.id ? styles.navItemActive : ''}`}
                    onClick={() => setSelectedProviderId(p.id)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

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
            </>
          )}

          {activeTab !== 'profile' && activeTab !== 'config' && (
            <div style={{ padding: '40px 0', color: 'var(--text-muted)' }}>
              <h3>{activeTab.toUpperCase()} 设置面板</h3>
              <p style={{ marginTop: '8px', fontSize: '13px' }}>功能模块建设中，你可以在“个人资料”与“配置 (模型 API Key)”中查看完整体验。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
