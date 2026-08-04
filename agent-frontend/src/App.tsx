import React, { useState, useEffect } from 'react';
import { ModelProviderContext } from './context/ModelContext';
import { Sidebar } from './components/layout/Sidebar';
import { ChatWorkspace } from './components/chat/ChatWorkspace';
import { ModelConfigModal } from './components/model/ModelConfigModal';
import { ModelInitModal } from './components/model/ModelInitModal';
import { fetchModelConfig, fetchSupportedVendors } from './services/api';

export const App: React.FC = () => {
  const [activeSessionId, setActiveSessionId] = useState('1');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [needsInit, setNeedsInit] = useState<boolean>(false);
  const [vendors, setVendors] = useState<string[]>(['gemini', 'openai', 'dashscope', 'deepseek', 'anthropic', 'ollama']);
  const [loading, setLoading] = useState<boolean>(true);

  const checkConfig = async () => {
    setLoading(true);
    // 1. 获取后端 application-vendor.yml 中配置的厂商列表
    const supportedVendors = await fetchSupportedVendors();
    if (supportedVendors && supportedVendors.length > 0) {
      setVendors(supportedVendors);
    }

    // 2. 获取当前本地 config.json 中的模型配置
    const config = await fetchModelConfig();
    
    // 判断是否有有效的配置（若无配置、或 apiKey 为空且非 ollama 厂商，则要求进入初始化设置页面）
    if (!config || !config.vendor || !config.name || (config.vendor !== 'ollama' && !config.apiKey)) {
      setNeedsInit(true);
    } else {
      setNeedsInit(false);
    }
    setLoading(false);
  };

  useEffect(() => {
    checkConfig();
  }, []);

  if (loading) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: '#0e0f17',
        color: '#9ca3af',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px'
      }}>
        正在检查 Agent 模型配置...
      </div>
    );
  }

  return (
    <ModelProviderContext>
      <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
        <Sidebar
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onNewChat={() => setActiveSessionId(String(Date.now()))}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
        <ChatWorkspace onOpenSettings={() => setIsSettingsOpen(true)} />
        <ModelConfigModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />

        {/* 若未配置模型，阻断式弹窗引导用户完成初次模型配置 */}
        {needsInit && (
          <ModelInitModal
            vendors={vendors}
            onSuccess={() => {
              setNeedsInit(false);
              checkConfig();
            }}
          />
        )}
      </div>
    </ModelProviderContext>
  );
};

export default App;
