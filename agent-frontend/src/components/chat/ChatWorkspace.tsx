import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ModelSelector } from '../model/ModelSelector';
import type { ChatMessage } from '../../types/chat';
import { Card } from '../common/Card';
import { CommandCard } from './CommandCard';
import {
  Plus,
  ArrowUp,
  Compass,
  Wrench,
  RotateCcw,
  Bug,
  Cloud,
  ChevronDown,
  ChevronRight,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Maximize2,
  Mic,
  Atom,
} from 'lucide-react';
import remarkGfm from 'remark-gfm';
import styles from './ChatWorkspace.module.css';

interface ChatWorkspaceProps {
  messages: ChatMessage[];
  onSendMessage: (prompt: string) => void;
  onOpenSettings: () => void;
}

/**
 * 容错清洗函数：修复模型输出中被压缩在同一行的 Markdown 表格
 */
function normalizeMarkdown(text?: string): string {
  if (!text) return '';
  let normalized = text;

  // 1. 修复单行拼接的 Markdown 表格：识别 `| ... | | ... |`，将中间的 `| |` 拆分成换行 `|\n|`
  normalized = normalized.replace(/\|\s*\|\s*(?=[^\n]*\|)/g, '|\n|');

  // 2. 确保 Markdown 表格与前后段落之间有空行分隔，以便 GFM 解析器正确将其识别为表格块
  normalized = normalized.replace(/([^\n])\n(\|.*\|)\n/g, '$1\n\n$2\n');

  return normalized;
}

const AssistantMessageItem: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
  const [isReasoningExpanded, setIsReasoningExpanded] = useState<boolean>(!msg.content);
  const [isProcessExpanded, setIsProcessExpanded] = useState<boolean>(true);

  const hasTools = Boolean(msg.tools && msg.tools.length > 0);
  const hasReasoning = Boolean(msg.reasoning && msg.reasoning.trim().length > 0);
  const isGenerating = !msg.content || Boolean(msg.tools?.some((t) => t.status === 'running'));
  const elapsedSec = msg.elapsedTime !== undefined
    ? msg.elapsedTime
    : (isGenerating && (msg.startTime || msg.createdAt)
      ? Math.max(1, Math.floor((Date.now() - (msg.startTime || msg.createdAt)) / 1000))
      : undefined);

  const handleCopy = () => {
    if (msg.content) {
      navigator.clipboard.writeText(msg.content);
    }
  };

  const getReasoningPreview = (text?: string): string => {
    if (!text) return '';
    const clean = text.trim().replace(/[\r\n]+/g, ' ');
    return clean.length > 130 ? clean.slice(0, 130) + '...' : clean;
  };

  return (
    <div className={styles.assistantMessage}>
      {/* 1. 正在思考中（未收到 reasoning、tools 及正文） */}
      {!msg.content && !hasReasoning && !hasTools && (
        <div className={styles.processHeader} style={{ color: '#9ca3af', cursor: 'default' }}>
          <span>正在思考...</span>
        </div>
      )}

      {/* 2. 耗时 Header（当有工具调用或已完成时展示） */}
      {(hasTools || (elapsedSec !== undefined && !isGenerating)) && (
        <div
          className={styles.processHeader}
          onClick={() => setIsProcessExpanded(!isProcessExpanded)}
        >
          {isGenerating ? (
            <span>已处理 {elapsedSec ?? 1}秒</span>
          ) : (
            <>
              <span>{elapsedSec !== undefined ? `耗时 ${elapsedSec}秒` : '执行过程'}</span>
              {isProcessExpanded ? (
                <ChevronDown size={14} style={{ color: '#9ca3af' }} />
              ) : (
                <ChevronRight size={14} style={{ color: '#9ca3af' }} />
              )}
            </>
          )}
        </div>
      )}

      {/* 3. 独立且优雅的 Think 思考过程（参考图2、图3设计） */}
      {hasReasoning && (
        <div className={styles.thinkSection}>
          {!isReasoningExpanded ? (
            <div
              className={styles.thinkCollapsedRow}
              onClick={() => setIsReasoningExpanded(true)}
              title="点击展开思考过程"
            >
              <Atom size={15} className={styles.thinkIcon} />
              <span className={styles.thinkLabel}>Think</span>
              <span className={styles.thinkDot}>·</span>
              <span className={styles.thinkPreview}>{getReasoningPreview(msg.reasoning)}</span>
            </div>
          ) : (
            <div className={styles.thinkExpandedContainer}>
              <div
                className={styles.thinkExpandedHeader}
                onClick={() => setIsReasoningExpanded(false)}
                title="点击收起思考过程"
              >
                <ChevronDown size={14} className={styles.thinkChevron} />
                <span className={styles.thinkLabel}>Think</span>
              </div>
              <div className={styles.thinkExpandedContent}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {normalizeMarkdown(msg.reasoning)}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. 工具执行卡片（折叠区） */}
      {hasTools && isProcessExpanded && (
        <div style={{ margin: '4px 0 10px' }}>
          {msg.tools!.map((tool) => (
            <CommandCard
              key={tool.toolCallId || tool.command || Math.random().toString()}
              toolName={tool.toolName}
              command={tool.command}
              status={tool.status}
              output={tool.output}
            />
          ))}
        </div>
      )}

      {/* 5. 最终回答正文 */}
      <div className={styles.markdownBody}>
        {msg.content ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {normalizeMarkdown(msg.content)}
          </ReactMarkdown>
        ) : (
          !hasReasoning && !hasTools && <span style={{ opacity: 0.5 }}>正在思考并生成回答...</span>
        )}
      </div>

      {/* 消息底部 4 个操作工具栏图标：复制、赞、踩、全屏/分享 */}
      {msg.content && (
        <div className={styles.messageActions}>
          <button className={styles.actionBtn} title="复制内容" onClick={handleCopy}>
            <Copy size={14} />
          </button>
          <button className={styles.actionBtn} title="赞">
            <ThumbsUp size={14} />
          </button>
          <button className={styles.actionBtn} title="踩">
            <ThumbsDown size={14} />
          </button>
          <button className={styles.actionBtn} title="全屏/扩展">
            <Maximize2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  messages,
  onSendMessage,
  onOpenSettings,
}) => {
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
          <div className={styles.messagesInner}>
            {messages.map((msg) => (
              <div key={msg.id} className={styles.messageRow}>
                {msg.role === 'user' ? (
                  <div className={styles.userMessage}>{msg.content}</div>
                ) : (
                  <AssistantMessageItem msg={msg} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Floating Input Area */}
      <div className={styles.bottomContainer}>
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
              <button className={styles.toolIconBtn} title="添加附件/文件关联">
                <Plus size={16} />
              </button>
            </div>

            <div className={styles.toolbarRight}>
              <ModelSelector onOpenSettings={onOpenSettings} />
              <button className={styles.micBtn} title="语音输入">
                <Mic size={18} />
              </button>
              <button
                className={`${styles.sendCircleBtn} ${
                  inputPrompt.trim() ? styles.sendCircleBtnActive : ''
                }`}
                onClick={handleSend}
                title="发送消息 (Enter)"
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
export default ChatWorkspace;
