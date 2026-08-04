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
    try {
      // 1. 获取后端 application-vendor.yml 中配置的厂商列表
      const supportedVendors = await fetchSupportedVendors();
      if (supportedVendors && supportedVendors.length > 0) {
        setVendors(supportedVendors);
      }

      // 2. 获取当前本地 config.json 中的模型配置
      const config = await fetchModelConfig();
      
      // 严密判断：只有在成功连通后端且拿到的 config 中关键属性（vendor, name）缺失或 apiKey（非ollama）明确为空时，才弹出初始化引导。
      // 若已有配置（如已有 vendor, name, apiKey），坚决不弹出初始化遮罩！
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
        background: '#f9fafb',
        color: '#6b7280',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '13px',
        fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
      }}>
        正在加载 ButvanAgent...
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

        {/* 仅在明确检测到配置项缺失时弹出与全局主题一致的模态框 */}
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
