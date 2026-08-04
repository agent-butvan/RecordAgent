import React, { useState } from 'react';
import { ModelSelector } from '../model/ModelSelector';
import { useModel } from '../../context/ModelContext';
import type { ChatMessage } from '../../types/chat';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import {
  Plus,
  ArrowUp,
  Folder,
  Mic,
  Compass,
  Wrench,
  RotateCcw,
  Bug,
  Cloud,
  Cpu,
  Sliders,
  Laptop,
  GitBranch,
  Timer,
  Sparkles
} from 'lucide-react';
import styles from './ChatWorkspace.module.css';

interface ChatWorkspaceProps {
  messages: ChatMessage[];
  onSendMessage: (prompt: string) => void;
  onOpenSettings: () => void;
}

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  messages,
  onSendMessage,
  onOpenSettings,
}) => {
  const { getActiveModel, getActiveProvider } = useModel();
  const activeModel = getActiveModel();
  const activeProvider = getActiveProvider();

  const [inputPrompt, setInputPrompt] = useState('');

  const handleSend = () => {
    if (!inputPrompt.trim()) return;
    const prompt = inputPrompt.trim();
    setInputPrompt('');
    onSendMessage(prompt);
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
      {/* Top Bar showing current AI Model Badge & Plus Tag matching Screenshot 1 */}
      <div className={styles.topBar}>
        <Badge variant="purple" icon={<Sparkles size={12} />} onClick={onOpenSettings} title="获取 Plus 共享更高级额">
          获取 Plus
        </Badge>

        <div className={styles.currentModelBadge} onClick={onOpenSettings} title="点击配置/切换模型">
          <Cpu size={13} style={{ color: '#2563eb' }} />
          <span>{activeProvider && activeModel ? `${activeProvider.name} (${activeModel.name})` : '未配置模型'}</span>
        </div>
      </div>

      {/* Hero Empty State OR Chat Messages */}
      {messages.length === 0 ? (
        <div className={styles.centerHero}>
          <Cloud className={styles.cloudIcon} />
          <h1 className={styles.heroTitle}>要在 <span style={{ textDecoration: 'underline', textUnderlineOffset: '6px' }}>ButvanAgent</span> 内开发什么？</h1>

          {/* 4 Quick Action Cards using extracted Card component */}
          <div className={styles.cardGrid}>
            <Card
              variant="interactive"
              className={styles.quickCard}
              onClick={() => handleQuickCardClick('探索并理解当前项目代码结构与架构设计')}
            >
              <div className={styles.cardIcon}>
                <Compass size={18} style={{ color: '#0284c7' }} />
              </div>
              <span className={styles.cardText}>探索并理解代码</span>
            </Card>

            <Card
              variant="interactive"
              className={styles.quickCard}
              onClick={() => handleQuickCardClick('构建新功能、应用或工具模块')}
            >
              <div className={styles.cardIcon}>
                <Wrench size={18} style={{ color: '#9333ea' }} />
              </div>
              <span className={styles.cardText}>构建新功能、应用或工具</span>
            </Card>

            <Card
              variant="interactive"
              className={styles.quickCard}
              onClick={() => handleQuickCardClick('审查代码并提出重构及修改建议')}
            >
              <div className={styles.cardIcon}>
                <RotateCcw size={18} style={{ color: '#16a34a' }} />
              </div>
              <span className={styles.cardText}>审查代码并提出修改建议</span>
            </Card>

            <Card
              variant="interactive"
              className={styles.quickCard}
              onClick={() => handleQuickCardClick('定位并修复项目中出现的 Bug 和报错')}
            >
              <div className={styles.cardIcon}>
                <Bug size={18} style={{ color: '#ea580c' }} />
              </div>
              <span className={styles.cardText}>修复问题和失败</span>
            </Card>
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

      {/* Bottom Floating Input Area matching Screenshot 1 */}
      <div className={styles.bottomContainer}>
        {/* Input Box Capsule Container with attached Top Tag Bar */}
        <div className={styles.inputBoxContainer}>
          <div className={styles.attachedPillsBar}>
            <div className={styles.pillItem}>
              <Folder size={13} style={{ color: '#64748b' }} />
              <span>ButvanAgent</span>
            </div>
            <div className={styles.pillItem}>
              <Laptop size={13} style={{ color: '#64748b' }} />
              <span>本地</span>
            </div>
            <div className={styles.pillItem}>
              <GitBranch size={13} style={{ color: '#64748b' }} />
              <span>develop</span>
            </div>
          </div>

          <div className={styles.inputBox}>
            <textarea
              className={styles.textarea}
              placeholder="随心输入"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
            />

            <div className={styles.inputToolbar}>
              <div className={styles.toolbarLeft}>
                <button className={styles.toolIconBtn} title="添加文件/图片">
                  <Plus size={16} />
                </button>
                <button className={styles.toolTextBtn} title="审批与自动运行设置">
                  <Timer size={14} />
                  请求批准
                </button>
              </div>

              <div className={styles.toolbarRight}>
                <div className={styles.presetDropdown} onClick={onOpenSettings} title="自定义轻度配置">
                  <span>自定义 轻度</span>
                  <Sliders size={12} />
                </div>
                <ModelSelector onOpenSettings={onOpenSettings} />
                <button className={styles.toolIconBtn} title="语音输入">
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
    </div>
  );
};
