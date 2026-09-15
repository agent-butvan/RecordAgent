import React, { useState, useEffect } from 'react';
import { useModel } from '../../context/ModelContext';
import { fetchAccountStatus, fetchSupportedVendors, type AccountStatus } from '../../services/api';
import { Button } from '../common/Button';
import { Select } from '../common/Select';
import { FormField } from '../common/FormField';
import { TextInput } from '../common/TextInput';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { ModelCard, type ModelCardItem } from './ModelCard';
import { FeatureSettingsPage, type FeatureSettingsTab } from '../settings/FeatureSettingsPage';
import { SettingsPageLayout } from '../settings/SettingsPageLayout';
import { TokenUsageSettingsPage } from '../settings/TokenUsageSettingsPage';
import { PersonalContextSettingsPage } from '../settings/PersonalContextSettingsPage';
import { ProfileSettingsPage } from '../settings/ProfileSettingsPage';
import { SlashCommandSettingsPage } from '../settings/SlashCommandSettingsPage';
import { DailyContextSettingsPage } from '../settings/DailyContextSettingsPage';
import {
  getFeaturePreferences,
  setChatTopBarPreference,
  setStudyWindowMode,
  subscribeFeaturePreferences,
} from '../../services/featurePreferences';
import type { ChatTopBarPreferences, FeaturePreferences, StudyWindowMode } from '../../types/preferences';
import {
  ArrowLeft,
  CalendarDays,
  Library,
  NotebookPen,
  Sliders,
  UserRound,
  Plus,
  Inbox,
  WalletCards,
  ChartNoAxesColumnIncreasing,
  Command,
  BrainCircuit,
  CloudSun,
} from 'lucide-react';
import styles from './ModelSettingsPage.module.css';

interface ModelSettingsPageProps {
  onBack: () => void;
  initialTab?: string;
}

const VENDOR_DEFAULT_URLS: Record<string, string> = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  deepseek: 'https://api.deepseek.com/v1',
  openai: 'https://api.openai.com/v1',
  dashscope: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  anthropic: 'https://api.anthropic.com/v1',
  ollama: 'http://localhost:11434/v1',
};

export const ModelSettingsPage: React.FC<ModelSettingsPageProps> = ({ onBack, initialTab = 'config' }) => {
  const {
    activeProviderId,
    activeModelId,
    selectActiveModel,
    addModelItem,
    deleteModelItem,
    testConnectionByUrl,
    getAllModels
  } = useModel();

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [supportedVendors, setSupportedVendors] = useState<string[]>(['gemini', 'openai', 'dashscope', 'deepseek', 'anthropic', 'ollama']);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [featurePreferences, setFeaturePreferencesState] = useState<FeaturePreferences>(getFeaturePreferences);
  
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

  useEffect(() => subscribeFeaturePreferences(setFeaturePreferencesState), []);

  useEffect(() => {
    fetchAccountStatus().then(setAccountStatus);
  }, []);

  useEffect(() => setActiveTab(initialTab), [initialTab]);

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

  const handleTestItem = async (modelItem: ModelCardItem) => {
    const key = `${modelItem.providerId}-${modelItem.id}`;
    setTestingMap((prev) => ({ ...prev, [key]: true }));

    const res = await testConnectionByUrl(
      modelItem.baseUrl || '',
      modelItem.apiKey || '',
      modelItem.providerType,
    );
    setTestResults((prev) => ({ ...prev, [key]: res }));
    setTestingMap((prev) => ({ ...prev, [key]: false }));
  };

  const handleStudyWindowModeChange = (mode: StudyWindowMode) => {
    setFeaturePreferencesState(setStudyWindowMode(mode));
  };

  const handleChatTopBarChange = (key: keyof ChatTopBarPreferences, visible: boolean) => {
    setFeaturePreferencesState(setChatTopBarPreference(key, visible));
  };

  const isFeatureTab = (tab: string): tab is FeatureSettingsTab => (
    tab === 'calendar' || tab === 'finance' || tab === 'library' || tab === 'record'
  );

  return (
    <div className={styles.pageContainer}>
      <div className={styles.settingsSidebar}>
        <button className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={14} />
          返回应用
        </button>

        <div className={styles.navGroup}>
          <div className={styles.groupLabel}>通用</div>
          <button
            className={`${styles.navItem} ${activeTab === 'config' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('config')}
          >
            <Sliders size={14} /> 配置 (模型 API Key)
          </button>
          <button
            className={`${styles.navItem} ${activeTab === 'account' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('account')}
          >
            <UserRound size={14} /> 个人资料
          </button>
          <button
            className={`${styles.navItem} ${activeTab === 'usage' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('usage')}
          >
            <ChartNoAxesColumnIncreasing size={14} /> Token 用量
          </button>
          <button
            className={`${styles.navItem} ${activeTab === 'context' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('context')}
          >
            <BrainCircuit size={14} /> 个人上下文
          </button>
          <button
            className={`${styles.navItem} ${activeTab === 'commands' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('commands')}
          >
            <Command size={14} /> 指令配置
          </button>
        </div>

        <div className={styles.navGroup}>
          <div className={styles.groupLabel}>功能</div>
          {[
            { id: 'calendar', label: '日历', icon: CalendarDays },
            { id: 'finance', label: '财务', icon: WalletCards },
            { id: 'library', label: '资料', icon: Library },
            { id: 'record', label: '记录', icon: NotebookPen },
            { id: 'daily-context', label: '天气与节假日', icon: CloudSun },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`${styles.navItem} ${activeTab === id ? styles.navItemActive : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Right Settings Content Section */}
      <div className={styles.settingsContent}>
        {/* 模型配置 */}
        {activeTab === 'config' && (
          <SettingsPageLayout
            title="模型配置"
            description="管理本地保存的模型，可随时测试连接并切换当前模型。"
            actions={(
              <>
                <Badge variant="default">{allModels.length} 个模型</Badge>
                <Button variant="primary" icon={<Plus size={15} />} onClick={() => setShowAddForm(true)}>
                  添加模型
                </Button>
              </>
            )}
          >

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
                      fullWidth
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
          </SettingsPageLayout>
        )}

        {activeTab === 'account' && <ProfileSettingsPage accountStatus={accountStatus} />}

        {activeTab === 'usage' && <TokenUsageSettingsPage />}

        {activeTab === 'context' && <PersonalContextSettingsPage />}

        {activeTab === 'commands' && <SlashCommandSettingsPage />}

        {activeTab === 'daily-context' && (
          <DailyContextSettingsPage
            chatTopBar={featurePreferences.chatTopBar}
            onChatTopBarChange={handleChatTopBarChange}
          />
        )}

        {isFeatureTab(activeTab) && (
          <FeatureSettingsPage
            tab={activeTab}
            studyWindowMode={featurePreferences.studyWindowMode}
            onStudyWindowModeChange={handleStudyWindowModeChange}
            chatTopBar={featurePreferences.chatTopBar}
            onChatTopBarChange={handleChatTopBarChange}
          />
        )}

      </div>
    </div>
  );
};
