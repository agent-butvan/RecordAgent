import React, { useState } from 'react';
import { ModelSelector } from '../model/ModelSelector';
import { useModel } from '../../context/ModelContext';
import { Send, Bot, Brain, Sparkles, ChevronRight, Terminal } from 'lucide-react';
import styles from './ChatWorkspace.module.css';

interface ChatWorkspaceProps {
  onOpenSettings: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  modelName?: string;
}

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({ onOpenSettings }) => {
  const { getActiveModel } = useModel();
  const activeModel = getActiveModel();

  const [inputPrompt, setInputPrompt] = useState('');
  const [showReasoning, setShowReasoning] = useState(true);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      modelName: 'DeepSeek R1 (Reasoner)',
      reasoning: '用户进入了 ButvanAgent 桌面工作台。\n解析需求：展示极致简约 Codex / 大厂风格 AI 桌面界面，支持模型选型与 API Key 配置。',
      content: '你好！我是你的 Agent 智能助手。当前已为你准备好大厂极简 Codex 风格桌面工作台，你可以点击顶部下拉框自由切换 DeepSeek、OpenAI、Ollama 或通义千问模型，也可以点击配置图标设置 API Key。',
    },
  ]);

  const handleSend = () => {
    if (!inputPrompt.trim()) return;

    const userMsg: Message = {
      id: String(Date.now()),
      role: 'user',
      content: inputPrompt.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');

    // Simulate AI response with Reasoning Chain
    setTimeout(() => {
      const assistantMsg: Message = {
        id: String(Date.now() + 1),
        role: 'assistant',
        modelName: activeModel?.name || 'Agent',
        reasoning: activeModel?.supportsReasoning
          ? `1. 分析当前选中模型: ${activeModel.name}\n2. 检测 API Endpoint 连通状态\n3. 构建打字机式流式数据返回`
          : undefined,
        content: `收到你的指令！使用【${activeModel?.name || '未选定模型'}】已就绪，可以在顶部“配置”按钮中随时修改 Endpoint 及 API Key。`,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    }, 600);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.workspace}>
      {/* Top Bar with ModelSelector */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Sparkles size={16} style={{ color: '#818cf8' }} />
          Butvan Agent Workspace
        </div>
        <ModelSelector onOpenSettings={onOpenSettings} />
      </div>

      {/* Main Messages List */}
      <div className={styles.chatArea}>
        {messages.map((msg) => (
          <div key={msg.id} className={styles.messageRow}>
            {msg.role === 'user' ? (
              <div className={styles.userMessage}>
                {msg.content}
              </div>
            ) : (
              <div className={styles.assistantMessage}>
                <div className={styles.avatar}>
                  <Bot size={14} style={{ color: '#818cf8' }} />
                  <span>{msg.modelName || 'Agent'}</span>
                </div>

                {msg.reasoning && (
                  <div className={styles.reasoningBox}>
                    <div 
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 600, color: '#34d399' }}
                      onClick={() => setShowReasoning(!showReasoning)}
                    >
                      <Brain size={12} />
                      深度思考 (Chain of Thought)
                      <ChevronRight size={12} style={{ transform: showReasoning ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }} />
                    </div>
                    {showReasoning && (
                      <div style={{ marginTop: '4px', whiteSpace: 'pre-line', opacity: 0.85 }}>
                        {msg.reasoning}
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.messageContent}>
                  {msg.content}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Floating Prompt Input */}
      <div className={styles.inputContainer}>
        <div className={styles.inputBox}>
          <textarea
            className={styles.textarea}
            placeholder="输入对话或 Agent 任务指令..."
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className={styles.inputFooter}>
            <div className={styles.hint}>
              <Terminal size={11} style={{ display: 'inline', marginRight: '4px' }} />
              按 Cmd + Enter 发送
            </div>
            <button className={styles.sendBtn} onClick={handleSend}>
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
