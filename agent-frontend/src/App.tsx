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
  fetchSessionDetail,
  createSessionApi,
  updateSessionTitleApi,
  deleteSessionApi,
  submitPermissionDecision,
} from './services/api';
import type { PermissionToolPayload } from './services/api';
import type { ChatSession, ChatMessage, Project, SessionSummaryDto, TranscriptMessageDto } from './types/chat';

function mapTranscriptToChatMessage(dto: TranscriptMessageDto): ChatMessage {
  const isUser = dto.role?.toUpperCase() === 'USER';
  return {
    id: dto.id,
    turnId: dto.turnId,
    role: isUser ? 'user' : 'assistant',
    modelName: isUser ? undefined : 'ButvanAgent',
    content: dto.content || '',
    reasoning: dto.thinking || undefined,
    createdAt: new Date(dto.createdAt).getTime() || Date.now(),
    status: dto.status,
    elapsedTime:
      dto.durationMillis != null
        ? Math.max(1, Math.round(dto.durationMillis / 1000))
        : undefined,
    tools:
      dto.tools && dto.tools.length > 0
        ? dto.tools.map((t) => ({
            toolCallId: t.toolCallId,
            toolName: t.toolName,
            command: t.command,
            output: t.output,
            status: (t.status ? t.status.toLowerCase() : 'completed') as
              | 'running'
              | 'completed'
              | 'failed'
              | 'cancelled',
          }))
        : undefined,
  };
}

export const MainLayout: React.FC<{
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
}> = ({ isSettingsOpen, setIsSettingsOpen }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [pendingPermission, setPendingPermission] = useState<{
    sessionId: string;
    assistantMessageId: string;
    approvalId: string;
    tool: PermissionToolPayload;
  } | null>(null);
  const [isPermissionSubmitting, setIsPermissionSubmitting] = useState(false);

  // 1. 初始化从后端 API 获取会话列表数据
  useEffect(() => {
    fetchSessions().then(async (data: SessionSummaryDto[]) => {
      if (Array.isArray(data) && data.length > 0) {
        const initialSessions: ChatSession[] = data.map((dto) => ({
          id: dto.id,
          kind: dto.kind,
          title: dto.title,
          lastMessagePreview: dto.lastMessagePreview,
          createdAt: new Date(dto.createdAt).getTime() || Date.now(),
          updatedAt: new Date(dto.updatedAt).getTime() || Date.now(),
          messages: [],
          isLoaded: false,
        }));
        setSessions(initialSessions);
        setActiveSessionId(initialSessions[0].id);
      } else {
        // 若无会话，由后端 API 创建一个初始化会话
        const res = await createSessionApi({ kind: 'GENERAL', title: '新对话' });
        if (res.success && res.data) {
          const created: ChatSession = {
            id: res.data.id,
            kind: res.data.kind,
            title: res.data.title,
            lastMessagePreview: res.data.lastMessagePreview,
            createdAt: new Date(res.data.createdAt).getTime() || Date.now(),
            updatedAt: new Date(res.data.updatedAt).getTime() || Date.now(),
            messages: [],
            isLoaded: true,
          };
          setSessions([created]);
          setActiveSessionId(created.id);
        }
      }
    });
  }, []);

  // 2. 切换当前激活会话时，若消息未加载，从后端 fetchSessionDetail 获取完整聊天记录
  useEffect(() => {
    if (!activeSessionId) return;

    const currentSession = sessions.find((s) => s.id === activeSessionId);
    if (currentSession && !currentSession.isLoaded) {
      fetchSessionDetail(activeSessionId).then((detail) => {
        if (detail) {
          const loadedMessages: ChatMessage[] = detail.messages.map(mapTranscriptToChatMessage);

          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSessionId
                ? {
                    ...s,
                    title: detail.summary.title,
                    lastMessagePreview: detail.summary.lastMessagePreview,
                    messages: loadedMessages,
                    isLoaded: true,
                  }
                : s
            )
          );
        }
      });
    }
  }, [activeSessionId, sessions]);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeMessages = activeSession?.messages || [];

  // 3. 新建普通独立会话（UUID 由后端统一生成）
  const handleNewGeneralChat = async () => {
    const res = await createSessionApi({ kind: 'GENERAL', title: '新对话' });
    if (res.success && res.data) {
      const newSession: ChatSession = {
        id: res.data.id,
        kind: res.data.kind,
        title: res.data.title,
        lastMessagePreview: res.data.lastMessagePreview,
        createdAt: new Date(res.data.createdAt).getTime() || Date.now(),
        updatedAt: new Date(res.data.updatedAt).getTime() || Date.now(),
        messages: [],
        isLoaded: true,
      };
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
    }
  };

  // 4. 新建项目绑定会话（项目绑定目前采用 GENERAL 会话挂载）
  const handleNewProjectChat = async (projectId: string) => {
    const targetProject = projects.find((p) => p.id === projectId);
    const titleName = targetProject ? `${targetProject.name} 会话` : '项目会话';

    const res = await createSessionApi({ kind: 'GENERAL', title: titleName });
    if (res.success && res.data) {
      const newSession: ChatSession = {
        id: res.data.id,
        kind: res.data.kind,
        title: res.data.title,
        lastMessagePreview: res.data.lastMessagePreview,
        projectId,
        createdAt: new Date(res.data.createdAt).getTime() || Date.now(),
        updatedAt: new Date(res.data.updatedAt).getTime() || Date.now(),
        messages: [],
        isLoaded: true,
      };
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
    }
  };

  // 5. 导入本地项目
  const handleImportProject = (name: string, path: string) => {
    const newProjectId = String(Date.now());
    const newProject: Project = {
      id: newProjectId,
      name,
      path,
      createdAt: Date.now(),
    };
    setProjects((prev) => [...prev, newProject]);
    handleNewProjectChat(newProjectId);
  };

  // 6. 删除会话
  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('确定删除该会话吗？此操作不可撤销。')) return;
    const res = await deleteSessionApi(id);
    if (res.success) {
      setSessions((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        if (activeSessionId === id) {
          const nextId = updated[0]?.id || '';
          setActiveSessionId(nextId);
        }
        return updated;
      });
    }
  };

  // 7. 修改会话标题
  const handleUpdateSessionTitle = async (id: string, newTitle: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s))
    );
    await updateSessionTitleApi(id, newTitle);
  };

  // 8. 发送消息发起 SSE 流
  const handleSendMessage = async (prompt: string) => {
    let currentSessionId = activeSessionId;
    let targetSession = sessions.find((s) => s.id === currentSessionId);

    // 若无激活会话，首先调用后端生成新会话 ID
    if (!targetSession) {
      const res = await createSessionApi({ kind: 'GENERAL', title: prompt.substring(0, 18) });
      if (res.success && res.data) {
        currentSessionId = res.data.id;
        targetSession = {
          id: res.data.id,
          kind: res.data.kind,
          title: res.data.title,
          lastMessagePreview: res.data.lastMessagePreview,
          createdAt: new Date(res.data.createdAt).getTime() || Date.now(),
          updatedAt: new Date(res.data.updatedAt).getTime() || Date.now(),
          messages: [],
          isLoaded: true,
        };
        setSessions((prev) => [targetSession!, ...prev]);
        setActiveSessionId(currentSessionId);
      } else {
        return;
      }
    }

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: prompt,
      createdAt: Date.now(),
    };

    const startTime = Date.now();
    const assistantMsgId = String(startTime + 1);
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      modelName: 'ButvanAgent',
      content: '',
      createdAt: startTime,
      startTime: startTime,
    };

    // 本地即时追加 UI 消息
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === currentSessionId) {
          return {
            ...s,
            updatedAt: Date.now(),
            messages: [...s.messages, userMsg, assistantMsg],
          };
        }
        return s;
      })
    );

    // 发起 SSE 流式调用，发送 content 字段
    streamAgentChat(
      {
        sessionId: currentSessionId,
        content: prompt,
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
        // 流式对话完成后同步耗时并重新刷新后端的最新详情
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === currentSessionId) {
              return {
                ...s,
                messages: s.messages.map((msg) => {
                  if (msg.id === assistantMsgId) {
                    const elapsed = Math.max(
                      1,
                      Math.floor((Date.now() - (msg.startTime || msg.createdAt)) / 1000)
                    );
                    return { ...msg, elapsedTime: elapsed };
                  }
                  return msg;
                }),
              };
            }
            return s;
          })
        );

        // 从后端重新同步最新的消息和摘要（包含更新的目录册 title / preview 及后端持久化的完整消息）
        fetchSessionDetail(currentSessionId).then((detail) => {
          if (detail) {
            const loadedMessages: ChatMessage[] = detail.messages.map(mapTranscriptToChatMessage);
            setSessions((prev) =>
              prev.map((s) =>
                s.id === currentSessionId
                  ? {
                      ...s,
                      title: detail.summary.title,
                      lastMessagePreview: detail.summary.lastMessagePreview,
                      messages: loadedMessages,
                    }
                  : s
              )
            );
          }
        });
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
                          '连接 Agent 对话服务失败或发生错误，请检查后端服务状态与 API Key 配置。',
                      }
                    : msg
                ),
              };
            }
            return s;
          })
        );
      },
      (toolCallPayload) => {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === currentSessionId) {
              return {
                ...s,
                messages: s.messages.map((msg) => {
                  if (msg.id === assistantMsgId) {
                    const tools = msg.tools ? [...msg.tools] : [];
                    const targetId = toolCallPayload.toolCallId || 'tool_' + Date.now();
                    const existingIndex = tools.findIndex((t) => t.toolCallId === targetId);

                    if (existingIndex >= 0) {
                      tools[existingIndex] = {
                        ...tools[existingIndex],
                        toolName: toolCallPayload.toolName || tools[existingIndex].toolName,
                        command: toolCallPayload.command || tools[existingIndex].command,
                      };
                    } else {
                      tools.push({
                        toolCallId: targetId,
                        toolName: toolCallPayload.toolName || 'custom_bash',
                        command: toolCallPayload.command || '',
                        status: 'running',
                      });
                    }
                    return { ...msg, tools };
                  }
                  return msg;
                }),
              };
            }
            return s;
          })
        );
      },
      (toolResultPayload) => {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === currentSessionId) {
              return {
                ...s,
                messages: s.messages.map((msg) => {
                  if (msg.id === assistantMsgId) {
                    const tools = msg.tools ? [...msg.tools] : [];
                    const targetId = toolResultPayload.toolCallId;

                    let targetIndex = -1;
                    if (targetId) {
                      targetIndex = tools.findIndex((t) => t.toolCallId === targetId);
                    }
                    if (targetIndex === -1) {
                      targetIndex = tools.findLastIndex((t) => t.status === 'running');
                    }

                    if (targetIndex >= 0) {
                      tools[targetIndex] = {
                        ...tools[targetIndex],
                        output: (tools[targetIndex].output || '') + (toolResultPayload.result || ''),
                        status: 'completed',
                      };
                    }
                    return { ...msg, tools };
                  }
                  return msg;
                }),
              };
            }
            return s;
          })
        );
      },
      (thinkingChunk) => {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === currentSessionId) {
              return {
                ...s,
                messages: s.messages.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, reasoning: (msg.reasoning || '') + thinkingChunk }
                    : msg
                ),
              };
            }
            return s;
          })
        );
      },
      (permissionPayload) => {
        setPendingPermission({
          sessionId: currentSessionId,
          assistantMessageId: assistantMsgId,
          approvalId: permissionPayload.approvalId,
          tool: permissionPayload.tool,
        });
      },
    );
  };

  /** 向当前 assistant 草稿追加恢复流产生的内容。 */
  const updateAssistantMessage = (
    sessionId: string,
    messageId: string,
    update: (message: ChatMessage) => ChatMessage,
  ) => {
    setSessions((prev) => prev.map((session) => session.id === sessionId
      ? { ...session, messages: session.messages.map((message) =>
        message.id === messageId ? update(message) : message) }
      : session));
  };

  /** 前端逐条提交决定；最后一条完成后建立新的 SSE 连接恢复 Agent。 */
  const handlePermissionDecision = async (approved: boolean, rememberForSession: boolean) => {
    if (!pendingPermission || isPermissionSubmitting) return;
    const current = pendingPermission;
    setIsPermissionSubmitting(true);
    try {
      const result = await submitPermissionDecision({
        sessionId: current.sessionId,
        approvalId: current.approvalId,
        toolCallId: current.tool.toolCallId,
        approved,
        rememberForSession,
      });

      if (!result.readyToResume && result.nextTool) {
        setPendingPermission({ ...current, tool: result.nextTool });
        return;
      }

      setPendingPermission(null);
      await streamAgentChat(
        { sessionId: current.sessionId, approvalId: current.approvalId },
        (text) => updateAssistantMessage(current.sessionId, current.assistantMessageId,
          (message) => ({ ...message, content: message.content + text })),
        () => {
          updateAssistantMessage(current.sessionId, current.assistantMessageId, (message) => ({
            ...message,
            elapsedTime: Math.max(1, Math.floor((Date.now() - (message.startTime || message.createdAt)) / 1000)),
          }));
          fetchSessionDetail(current.sessionId).then((detail) => {
            if (!detail) return;
            const messages = detail.messages.map(mapTranscriptToChatMessage);
            setSessions((prev) => prev.map((session) => session.id === current.sessionId
              ? { ...session, title: detail.summary.title, lastMessagePreview: detail.summary.lastMessagePreview, messages }
              : session));
          });
        },
        (error) => updateAssistantMessage(current.sessionId, current.assistantMessageId,
          (message) => ({ ...message, content: message.content || `恢复任务失败：${error.message}` })),
        (tool) => updateAssistantMessage(current.sessionId, current.assistantMessageId, (message) => ({
          ...message,
          tools: [...(message.tools || []), {
            toolCallId: tool.toolCallId || `tool_${Date.now()}`,
            toolName: tool.toolName || 'tool', command: tool.command || '', status: 'running',
          }],
        })),
        (result) => updateAssistantMessage(current.sessionId, current.assistantMessageId, (message) => ({
          ...message,
          tools: (message.tools || []).map((tool) => tool.toolCallId === result.toolCallId
            ? { ...tool, status: 'completed', output: (tool.output || '') + (result.result || '') }
            : tool),
        })),
        (thinking) => updateAssistantMessage(current.sessionId, current.assistantMessageId,
          (message) => ({ ...message, reasoning: (message.reasoning || '') + thinking })),
        (permissionPayload) => setPendingPermission({
          sessionId: current.sessionId,
          assistantMessageId: current.assistantMessageId,
          approvalId: permissionPayload.approvalId,
          tool: permissionPayload.tool,
        }),
      );
    } catch (error) {
      updateAssistantMessage(current.sessionId, current.assistantMessageId, (message) => ({
        ...message,
        content: message.content || '提交权限决定失败，请重试。',
      }));
    } finally {
      setIsPermissionSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {isSettingsOpen ? (
        <ModelSettingsPage onBack={() => setIsSettingsOpen(false)} />
      ) : (
        <>
          <Sidebar
            projects={projects}
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={setActiveSessionId}
            onNewGeneralChat={handleNewGeneralChat}
            onNewProjectChat={handleNewProjectChat}
            onImportProject={handleImportProject}
            onDeleteSession={handleDeleteSession}
            onUpdateSessionTitle={handleUpdateSessionTitle}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
          <ChatWorkspace
            messages={activeMessages}
            onSendMessage={handleSendMessage}
            onOpenSettings={() => setIsSettingsOpen(true)}
            pendingPermission={pendingPermission}
            isPermissionSubmitting={isPermissionSubmitting}
            onPermissionDecision={handlePermissionDecision}
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
      <div className="bootScreen">
        <div className="bootSpinner" aria-hidden="true" />
        <span>正在加载...</span>
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
      />
    </ModelProviderContext>
  );
};

export default App;
