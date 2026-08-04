import React, { useState, useEffect } from 'react';
import { ModelSelector } from '../model/ModelSelector';
import { useModel } from '../../context/ModelContext';
import { streamAgentChat, fetchModelConfig } from '../../services/api';
import {
  Sparkles,
  Plus,
  ArrowUp,
  Folder,
  Settings2,
  Mic,
  Compass,
  Wrench,
  RotateCcw,
  Bug,
  Cloud,
  Clock,
  Cpu
} from 'lucide-react';
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
  const { getActiveModel, getActiveProvider } = useModel();
  const activeModel = getActiveModel();
  const activeProvider = getActiveProvider();

  const [inputPrompt, setInputPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  const handleSend = () => {
    if (!inputPrompt.trim()) return;

    const userMsg: Message = {
      id: String(Date.now()),
      role: 'user',
      content: inputPrompt.trim(),
    };

    const modelDisplayName = activeProvider && activeModel
      ? `${activeProvider.name} (${activeModel.name})`
      : 'ButvanAgent';

    const assistantMsgId = String(Date.now() + 1);
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      modelName: modelDisplayName,
      content: '', // 初始为空，随着 SSE 推流实时流式填充
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    const currentPrompt = inputPrompt.trim();
    setInputPrompt('');

    // 发起 SSE 流式调用
    streamAgentChat(
      {
        sessionId: 'session_default',
        context: currentPrompt,
      },
      (chunkText) => {
        // 增量流式渲染打字效果
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            if (msg.id === assistantMsgId) {
              return { ...msg, content: msg.content + chunkText };
            }
            return msg;
          })
        );
      },
      () => {
        console.log('Agent 流式传输完毕');
      },
      (err) => {
        console.error('Agent 对话流传输异常:', err);
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            if (msg.id === assistantMsgId && !msg.content) {
              return { ...msg, content: '连接 Agent 对话服务失败或发生错误，请检查后端网络与 API Key 配置。' };
            }
            return msg;
          })
        );
      }
    );
  };

  const handleQuickCardClick = (promptText: string) => {
    setInputPrompt(promptText);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.workspace}>
      {/* Top Bar showing current AI Model Badge */}
      <div className={styles.topBar}>
        <div className={styles.currentModelBadge} onClick={onOpenSettings} title="点击配置/切换模型">
          <Cpu size={13} style={{ color: '#2563eb' }} />
          <span>当前模型: {activeProvider && activeModel ? `${activeProvider.name} (${activeModel.name})` : '未配置模型'}</span>
        </div>

        <div className={styles.plusTag} onClick={onOpenSettings}>
          <Sparkles size={12} />
          获取 Plus
        </div>
      </div>

      {/* Hero Empty State OR Chat Messages */}
      {messages.length === 0 ? (
        <div className={styles.centerHero}>
          <Cloud className={styles.cloudIcon} />
          <h1 className={styles.heroTitle}>我们该构建什么？</h1>

          {/* 4 Quick Action Cards */}
          <div className={styles.cardGrid}>
            <div
              className={styles.quickCard}
              onClick={() => handleQuickCardClick('探索并理解当前项目代码结构与架构设计')}
            >
              <div className={styles.cardIcon}>
                <Compass size={20} style={{ color: '#2563EB' }} />
              </div>
              <span className={styles.cardText}>探索并理解代码</span>
            </div>

            <div
              className={styles.quickCard}
              onClick={() => handleQuickCardClick('构建新功能、应用或工具模块')}
            >
              <div className={styles.cardIcon}>
                <Wrench size={20} style={{ color: '#9333EA' }} />
              </div>
              <span className={styles.cardText}>构建新功能、应用或工具</span>
            </div>

            <div
              className={styles.quickCard}
              onClick={() => handleQuickCardClick('审查代码并提出重构及修改建议')}
            >
              <div className={styles.cardIcon}>
                <RotateCcw size={20} style={{ color: '#059669' }} />
              </div>
              <span className={styles.cardText}>审查代码并提出修改建议</span>
            </div>

            <div
              className={styles.quickCard}
              onClick={() => handleQuickCardClick('定位并修复项目中出现的 Bug 和报错')}
            >
              <div className={styles.cardIcon}>
                <Bug size={20} style={{ color: '#EA580C' }} />
              </div>
              <span className={styles.cardText}>修复问题和失败</span>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.messagesArea}>
          {messages.map((msg) => (
            <div key={msg.id} className={styles.messageRow}>
              {msg.role === 'user' ? (
                <div className={styles.userMessage}>{msg.content}</div>
              ) : (
                <div className={styles.assistantMessage}>
                  <div className={styles.avatar}>
                    <Cpu size={14} style={{ color: '#2563eb' }} />
                    <span>{msg.modelName || 'ButvanAgent'}</span>
                  </div>
                  {msg.reasoning && (
                    <div className={styles.reasoningBox}>
                      <strong>思考过程:</strong> {msg.reasoning}
                    </div>
                  )}
                  <div style={{ fontSize: '14px', lineHeight: 1.6 }}>
                    {msg.content || <span style={{ opacity: 0.5 }}>正在思考并生成回答...</span>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bottom Floating Codex Style Input Area */}
      <div className={styles.bottomContainer}>
        {/* Top Notice Pill Bar */}
        <div className={styles.noticeBar}>
          <div className={styles.noticeText}>
            <Clock size={14} />
            <span>你的 ButvanAgent 配额已就绪 · 点击右侧随时配置多厂商 AI 密匙</span>
          </div>
          <button className={styles.upgradeBtn} onClick={onOpenSettings}>
            升级/配置
          </button>
        </div>

        {/* Input Box Capsule Container */}
        <div className={styles.inputBox}>
          <div className={styles.projectPill}>
            <Folder size={13} />
            选择项目
          </div>

          <textarea
            className={styles.textarea}
            placeholder="随心输入..."
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <div className={styles.inputToolbar}>
            <div className={styles.toolbarLeft}>
              <button className={styles.toolBtn} title="添加文件/图片">
                <Plus size={16} />
              </button>
              <button className={styles.toolBtn} title="审批与自动运行设置">
                <Settings2 size={14} />
                替我审批
              </button>
            </div>

            <div className={styles.toolbarRight}>
              {/* Model selector dropdown embedded inside input bar */}
              <ModelSelector onOpenSettings={onOpenSettings} />
              <button className={styles.toolBtn} title="语音输入">
                <Mic size={15} />
              </button>
              <button
                className={`${styles.sendCircleBtn} ${
                  inputPrompt.trim() ? styles.sendCircleBtnActive : ''
                }`}
                onClick={handleSend}
              >
                <ArrowUp size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
