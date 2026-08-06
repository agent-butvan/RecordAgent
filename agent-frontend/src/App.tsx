import React, { useState, useEffect } from 'react';
import { ModelProviderContext } from './context/ModelContext';
import { Sidebar } from './components/layout/Sidebar';
import { ChatWorkspace } from './components/chat/ChatWorkspace';
import { ModelSettingsPage } from './components/model/ModelSettingsPage';
import { ModelInitPage } from './components/model/ModelInitPage';
import {
  fetchModelConfig,
  fetchSupportedVendors,
  streamAgentChat,
  fetchSessions,
  createSessionApi,
  deleteSessionApi,
} from './services/api';
import type { ChatSession, ChatMessage } from './types/chat';

export const MainLayout: React.FC<{
  onOpenSettings: () => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
}> = ({ isSettingsOpen, setIsSettingsOpen }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');

  // 初始化从后端 API 获取会话列表数据
  useEffect(() => {
    fetchSessions().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setSessions(data);
        setActiveSessionId(data[0].id);
      }
    });
  }, []);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeMessages = activeSession?.messages || [];

  const handleNewChat = () => {
    const newSessionId = String(Date.now());
    const newSession: ChatSession = {
      id: newSessionId,
      title: '新对话',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSessionId);
    createSessionApi(newSession);
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      if (activeSessionId === id) {
        setActiveSessionId(updated[0]?.id || '');
      }
      return updated;
    });
    deleteSessionApi(id);
  };


  const handleSendMessage = (prompt: string) => {
    let currentSessionId = activeSessionId;
    let targetSession = sessions.find((s) => s.id === currentSessionId);

    // 若无任何激活会话，自动新建
    if (!targetSession) {
      currentSessionId = String(Date.now());
      const newSession: ChatSession = {
        id: currentSessionId,
        title: prompt.length > 18 ? prompt.substring(0, 18) + '...' : prompt,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
      };
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(currentSessionId);
      targetSession = newSession;
    }

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: prompt,
      createdAt: Date.now(),
    };

    const assistantMsgId = String(Date.now() + 1);
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      modelName: 'ButvanAgent',
      content: '',
      createdAt: Date.now(),
    };

    // 追加消息并自动将新会话首句设为 Title
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === currentSessionId) {
          const isFirstMessage = s.messages.length === 0;
          const newTitle = isFirstMessage
            ? prompt.length > 18
              ? prompt.substring(0, 18) + '...'
              : prompt
            : s.title;

          return {
            ...s,
            title: newTitle,
            updatedAt: Date.now(),
            messages: [...s.messages, userMsg, assistantMsg],
          };
        }
        return s;
      })
    );

    // 发起 SSE 流式调用
    streamAgentChat(
      {
        sessionId: currentSessionId,
        context: prompt,
      },
      (chunkText) => {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === currentSessionId) {
              return {
                ...s,
                messages: s.messages.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: msg.content + chunkText }
                    : msg
                ),
              };
            }
            return s;
          })
        );
      },
      () => {
        console.log('Session 流式对话完成:', currentSessionId);
      },
      (err) => {
        console.error('Session 流式对话异常:', err);
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === currentSessionId) {
              return {
                ...s,
                messages: s.messages.map((msg) =>
                  msg.id === assistantMsgId && !msg.content
                    ? {
                        ...msg,
                        content:
                          '连接 Agent 对话服务失败或发生错误，请检查后端网络与 API Key 配置。',
                      }
                    : msg
                ),
              };
            }
            return s;
          })
        );
      }
    );
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {isSettingsOpen ? (
        <ModelSettingsPage onBack={() => setIsSettingsOpen(false)} />
      ) : (
        <>
          <Sidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={setActiveSessionId}
            onNewChat={handleNewChat}
            onDeleteSession={handleDeleteSession}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
          <ChatWorkspace
            messages={activeMessages}
            onSendMessage={handleSendMessage}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        </>
      )}
    </div>
  );
};

export const App: React.FC = () => {
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
      <MainLayout
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
    </ModelProviderContext>
  );
};

export default App;
