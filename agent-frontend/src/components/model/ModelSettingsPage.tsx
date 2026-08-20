import React, { useState, useEffect } from 'react';
import { useModel } from '../../context/ModelContext';
import { fetchSupportedVendors } from '../../services/api';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Toggle } from '../common/Toggle';
import { Select } from '../common/Select';
import { FormField } from '../common/FormField';
import { TextInput } from '../common/TextInput';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { ModelCard } from './ModelCard';
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

  const [activeTab, setActiveTab] = useState<string>('general');
  const [supportedVendors, setSupportedVendors] = useState<string[]>(['gemini', 'openai', 'dashscope', 'deepseek', 'anthropic', 'ollama']);
  
  // General Tab State matching Screenshot 3
  const [defaultPermission, setDefaultPermission] = useState(true);
  const [fullPermission, setFullPermission] = useState(true);
  const [openTarget, setOpenTarget] = useState('vscode');
  const [language, setLanguage] = useState('auto');
  const [showInMenuBar, setShowInMenuBar] = useState(true);
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [terminalPos, setTerminalPos] = useState<'bottom' | 'right'>('bottom');
  const [preventSleep, setPreventSleep] = useState(false);

  const allModels = getAllModels();

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [formVendor, setFormVendor] = useState('gemini');
  const [formBaseUrl, setFormBaseUrl] = useState(VENDOR_DEFAULT_URLS.gemini);
  const [formApiKey, setFormApiKey] = useState('');
  const [formModelId, setFormModelId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formReasoning, setFormReasoning] = useState(false);

  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [testingMap, setTestingMap] = useState<Record<string, boolean>>({});

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

  return (
    <div className={styles.pageContainer}>
      {/* Left Settings Navigation Sidebar matching Screenshot 3 */}
      <div className={styles.settingsSidebar}>
        <button className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={14} />
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
            className={`${styles.navItem} ${activeTab === 'config' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('config')}
          >
            <Sliders size={14} /> 配置 (模型 API Key)
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
          <button className={styles.navItem}><FolderArchive size={14} /> 已归档的聊天</button>
        </div>
      </div>

      {/* Right Settings Content Section */}
      <div className={styles.settingsContent}>
        {/* TAB 1: 常规设置 (Matching Screenshot 3) */}
        {activeTab === 'general' && (
          <div className={styles.sectionContainer}>
            <h1 className={styles.pageTitle}>常规</h1>

            {/* Permission Card Section */}
            <div className={styles.sectionHeader}>权限</div>
            <Card variant="flat" className={styles.settingsCard}>
              <div className={styles.settingRow}>
                <div className={styles.rowInfo}>
                  <div className={styles.rowTitle}>默认权限</div>
                  <div className={styles.rowSub}>默认情况下，ButvanAgent 可以读取和编辑其工作空间中的文件。需要时，它可以请求额外访问权限。</div>
                </div>
                <Toggle checked={defaultPermission} onChange={setDefaultPermission} />
              </div>

              <div className={styles.divider} />

              <div className={styles.settingRow}>
                <div className={styles.rowInfo}>
                  <div className={styles.rowTitle}>完全访问权限</div>
                  <div className={styles.rowSub}>当以完整访问权限运行时，它无需你的批准即可编辑你电脑上的任何文件，并运行可访问网络的命令。<a href="#" style={{ color: '#2563eb' }}>了解更多</a></div>
                </div>
                <Toggle checked={fullPermission} onChange={setFullPermission} />
              </div>
            </Card>

            {/* General Settings Card Section */}
            <div className={styles.sectionHeader} style={{ marginTop: '28px' }}>常规</div>
            <Card variant="flat" className={styles.settingsCard}>
              <div className={styles.settingRow}>
                <div className={styles.rowInfo}>
                  <div className={styles.rowTitle}>默认文件打开目标</div>
                  <div className={styles.rowSub}>默认打开文件和文件夹的位置</div>
                </div>
                <Select
                  value={openTarget}
                  onChange={(e) => setOpenTarget(e.target.value)}
                  options={[
                    { label: 'VS Code', value: 'vscode' },
                    { label: 'Cursor', value: 'cursor' },
                    { label: 'IntelliJ IDEA', value: 'idea' },
                  ]}
                />
              </div>

              <div className={styles.divider} />

              <div className={styles.settingRow}>
                <div className={styles.rowInfo}>
                  <div className={styles.rowTitle}>语言</div>
                  <div className={styles.rowSub}>应用 UI 语言</div>
                </div>
                <Select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  options={[
                    { label: '自动检测', value: 'auto' },
                    { label: '简体中文', value: 'zh' },
                    { label: 'English', value: 'en' },
                  ]}
                />
              </div>

              <div className={styles.divider} />

              <div className={styles.settingRow}>
                <div className={styles.rowInfo}>
                  <div className={styles.rowTitle}>在菜单栏中显示</div>
                  <div className={styles.rowSub}>关闭主窗口后，仍在 macOS 菜单栏中保留 ButvanAgent</div>
                </div>
                <Toggle checked={showInMenuBar} onChange={setShowInMenuBar} />
              </div>

              <div className={styles.divider} />

              <div className={styles.settingRow}>
                <div className={styles.rowInfo}>
                  <div className={styles.rowTitle}>底部面板</div>
                  <div className={styles.rowSub}>在应用标题栏中显示底部面板控件</div>
                </div>
                <Toggle checked={showBottomPanel} onChange={setShowBottomPanel} />
              </div>

              <div className={styles.divider} />

              <div className={styles.settingRow}>
                <div className={styles.rowInfo}>
                  <div className={styles.rowTitle}>默认终端位置</div>
                  <div className={styles.rowSub}>选择终端快捷键和环境操作在何处打开终端标签页</div>
                </div>
                <div className={styles.segmentControl}>
                  <button
                    className={`${styles.segmentBtn} ${terminalPos === 'bottom' ? styles.segmentActive : ''}`}
                    onClick={() => setTerminalPos('bottom')}
                  >
                    底部
                  </button>
                  <button
                    className={`${styles.segmentBtn} ${terminalPos === 'right' ? styles.segmentActive : ''}`}
                    onClick={() => setTerminalPos('right')}
                  >
                    右侧
                  </button>
                </div>
              </div>

              <div className={styles.divider} />

              <div className={styles.settingRow}>
                <div className={styles.rowInfo}>
                  <div className={styles.rowTitle}>运行时防止系统休眠</div>
                  <div className={styles.rowSub}>在 Agent 运行任务时，让电脑保持唤醒状态</div>
                </div>
                <Toggle checked={preventSleep} onChange={setPreventSleep} />
              </div>

              <div className={styles.divider} />

              <div className={styles.settingRow}>
                <div className={styles.rowInfo}>
                  <div className={styles.rowTitle}>打开开源许可证</div>
                  <div className={styles.rowSub}>捆绑依赖项的第三方声明</div>
                </div>
                <Button variant="secondary" size="sm">查看</Button>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 2: 模型配置列表 (Config) */}
        {activeTab === 'config' && (
          <div>
            <div className={styles.topHeader}>
              <div>
                <h2 className={styles.title}>模型配置列表 (Model List)</h2>
                <p className={styles.configSubtitle}>
                  托管在本地 ~/.butvan-agent/config.json 的多厂商 AI 大模型配置
                </p>
              </div>

              <div className={styles.headerActions}>
                <Badge variant="primary">已配置 {allModels.length} 个模型</Badge>
                <Button variant="primary" icon={<Plus size={15} />} onClick={() => setShowAddForm(true)}>
                  新增配置模型
                </Button>
              </div>
            </div>

            {/* 新增模型配置弹框 */}
            <Modal
              open={showAddForm}
              title="新增 AI 大模型配置"
              onClose={() => setShowAddForm(false)}
            >
              <form onSubmit={handleSaveModel} className={styles.addForm}>
                <div className={styles.formGrid}>
                  <FormField label="模型供应商" htmlFor="model-vendor" required>
                    <Select
                      id="model-vendor"
                      fieldSize="md"
                      className={styles.fullWidth}
                      value={formVendor}
                      onChange={(e) => handleVendorChange(e.target.value)}
                      options={supportedVendors.map((v) => ({
                        label: v,
                        value: v,
                      }))}
                    />
                  </FormField>

                  <FormField label="模型名称 / ID" htmlFor="model-name" required>
                    <TextInput
                      id="model-name"
                      value={formName}
                      onChange={(e) => {
                        setFormName(e.target.value);
                        setFormModelId(e.target.value);
                      }}
                      placeholder="例如 gemini-2.5-flash / deepseek-chat"
                      required
                    />
                  </FormField>
                </div>

                <FormField label="API Key 密钥" htmlFor="model-api-key" required>
                  <TextInput
                    id="model-api-key"
                    type="password"
                    value={formApiKey}
                    onChange={(e) => setFormApiKey(e.target.value)}
                    placeholder="sk-... / AIza..."
                    required
                    autoComplete="off"
                  />
                </FormField>

                <div className={styles.formActions}>
                  <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>取消</Button>
                  <Button type="submit" variant="primary">保存配置模型</Button>
                </div>
              </form>
            </Modal>

            {/* EMPTY STATE */}
            {allModels.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <Inbox size={30} />
                </div>
                <h3 className={styles.emptyTitle}>
                  暂未配置任何 AI 大模型
                </h3>
                <p className={styles.emptyDesc}>
                  本地配置文件 <code>~/.butvan-agent/config.json</code> 当前无任何有效模型。请点击下方按钮添加您的第一个 Gemini、DeepSeek 或 OpenAI 模型。
                </p>
                <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowAddForm(true)}>
                  新增配置模型
                </Button>
              </div>
            ) : (
              /* REAL MODEL LIST CARDS FROM config.json */
              <div className={styles.modelList}>
                {allModels.map((item) => {
                  const key = `${item.providerId}-${item.id}`;
                  const isActive = (item.providerId === activeProviderId || item.providerType === activeProviderId) && item.id === activeModelId;
                  const testRes = testResults[key];
                  const isTesting = !!testingMap[key];

                  return (
                    <ModelCard
                      key={key}
                      item={item}
                      isActive={isActive}
                      onSelect={() => selectActiveModel(item.providerId, item.id)}
                      onDelete={() => deleteModelItem(item.providerId, item.id)}
                      onTest={() => handleTestItem(item)}
                      isTesting={isTesting}
                      testResult={testRes}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab !== 'config' && activeTab !== 'general' && (
          <div style={{ padding: '40px 0', color: '#64748b' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{activeTab.toUpperCase()} 设置页面</h3>
            <p style={{ marginTop: '8px', fontSize: '13px' }}>可在“常规”或“配置 (模型 API Key)”中查看与修改配置。</p>
          </div>
        )}
      </div>
    </div>
  );
};
