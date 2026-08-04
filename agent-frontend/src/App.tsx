import React, { useState, useEffect } from 'react';
import { ModelProviderContext } from './context/ModelContext';
import { Sidebar } from './components/layout/Sidebar';
import { ChatWorkspace } from './components/chat/ChatWorkspace';
import { ModelConfigModal } from './components/model/ModelConfigModal';
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
      const supportedVendors = await fetchSupportedVendors();
      if (supportedVendors && supportedVendors.length > 0) {
        setVendors(supportedVendors);
      }

      const config = await fetchModelConfig();
      if (config && config.vendor && config.name) {
        if (config.vendor !== 'ollama' && !config.apiKey) {
          setNeedsInit(true);
        } else {
          setNeedsInit(false);
        }
      } else {
        setNeedsInit(false);
      }
    } catch (e) {
      console.error('检查模型配置状态异常:', e);
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

  // 若未初始化配置，直接全屏渲染初始化设置页面 ModelInitPage
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
      </div>
    </ModelProviderContext>
  );
};

export default App;
