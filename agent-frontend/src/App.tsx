import React, { useState, useEffect } from 'react';
import { ModelProviderContext } from './context/ModelContext';
import { Sidebar } from './components/layout/Sidebar';
import { ChatWorkspace } from './components/chat/ChatWorkspace';
import { ModelSettingsPage } from './components/model/ModelSettingsPage';
import { ModelInitPage } from './components/model/ModelInitPage';
import { fetchModelConfig, fetchSupportedVendors } from './services/api';

export const App: React.FC = () => {
  const [activeSessionId, setActiveSessionId] = useState('1');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [needsInit, setNeedsInit] = useState<boolean>(false);
  const [vendors, setVendors] = useState<string[]>(['gemini', 'openai', 'dashscope', 'deepseek', 'anthropic', 'ollama']);
  const [loading, setLoading] = useState<boolean>(true);

  const checkConfig = async () => {
    setLoading(true);
    try {
      // 1. 从后端获取支持的厂商列表
      const supportedVendors = await fetchSupportedVendors();
      if (supportedVendors && supportedVendors.length > 0) {
        setVendors(supportedVendors);
      }

      // 2. 从后端获取当前本地 config.json 中的模型配置
      const config = await fetchModelConfig();
      
      // 判断逻辑：若无配置，或字段内容为空（vendor/name/apiKey为空），则判定需要初始化
      if (!config || 
          !config.vendor || !config.vendor.trim() || 
          !config.name || !config.name.trim() || 
          (config.vendor !== 'ollama' && (!config.apiKey || !config.apiKey.trim()))) {
        setNeedsInit(true);
      } else {
        setNeedsInit(false);
      }
    } catch (e) {
      console.error('检查模型配置状态失败:', e);
      setNeedsInit(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkConfig();
  }, []);

  if (loading) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: '#ffffff',
        color: '#6b7280',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
      }}>
        正在加载...
      </div>
    );
  }

  // 若未初始化配置（字段为空），全屏展示初始化设置页面 ModelInitPage
  if (needsInit) {
    return (
      <ModelInitPage
        vendors={vendors}
        onSuccess={() => {
          setNeedsInit(false);
          checkConfig();
        }}
      />
    );
  }

  return (
    <ModelProviderContext>
      <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
        {isSettingsOpen ? (
          <ModelSettingsPage onBack={() => setIsSettingsOpen(false)} />
        ) : (
          <>
            <Sidebar
              activeSessionId={activeSessionId}
              onSelectSession={setActiveSessionId}
              onNewChat={() => setActiveSessionId(String(Date.now()))}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
            <ChatWorkspace onOpenSettings={() => setIsSettingsOpen(true)} />
          </>
        )}
      </div>
    </ModelProviderContext>
  );
};

export default App;
