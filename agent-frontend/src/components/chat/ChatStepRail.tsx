import React, { useMemo } from 'react';
import type { ChatMessage } from '../../types/chat';
import { ChapterScrubber, type Chapter } from './ChapterScrubber';

export interface StepRailChapter extends Chapter {
  /** 点击该章节时应滚动定位到的消息行 id。 */
  messageId?: string;
}

function formatTime(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

interface BuildResult {
  chapters: StepRailChapter[];
  currentIndex: number;
}

/**
 * 从消息流中提取对话章节：一个来回（用户提问 + Agent 回复）算一个节点，
 * 标题取用户提问内容，内容区取 Agent 最终回复；工具调用等内部过程不进入时间轨。
 */
function buildChapters(messages: ChatMessage[]): BuildResult | null {
  const chapters: StepRailChapter[] = [];

  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role !== 'user') continue;
    const user = messages[i];

    // 查找该提问之后的第一条 Agent 回复
    let assistant: ChatMessage | undefined;
    for (let j = i + 1; j < messages.length; j++) {
      if (messages[j].role === 'assistant') {
        assistant = messages[j];
        break;
      }
    }

    if (!assistant) {
      // 最后一条提问尚无回复：视为进行中
      chapters.push({
        id: `turn-pending-${user.id}`,
        title: user.content || '对话',
        description: 'Agent 正在处理…',
        meta: '…',
        messageId: user.id,
      });
      continue;
    }

    const isGenerating =
      assistant.status === undefined && assistant.elapsedTime === undefined;
    const replyText = assistant.content || (isGenerating ? 'Agent 正在处理…' : '');
    if (!replyText) continue; // 跳过既无正文也未在生成的旧回复

    chapters.push({
      id: `turn-${user.id}`,
      title: user.content || '对话',
      description: replyText,
      meta: formatTime(user.createdAt),
      messageId: assistant.id,
    });
  }

  if (chapters.length === 0) return null;

  // 当前位置始终指向最近一次对话
  const currentIndex = Math.max(0, chapters.length - 1);
  return { chapters, currentIndex };
}

export interface ChatStepRailProps {
  messages: ChatMessage[];
  onSelect?: (chapter: StepRailChapter) => void;
}

/**
 * 聊天内容左侧的 Codex 风格任务步骤时间轨。
 */
export const ChatStepRail: React.FC<ChatStepRailProps> = ({
  messages,
  onSelect,
}) => {
  const built = useMemo(() => buildChapters(messages), [messages]);

  if (!built) return null;

  return (
    <ChapterScrubber
      chapters={built.chapters}
      currentIndex={built.currentIndex}
      side="right"
      label="当前任务步骤"
      onSelect={(chapter) => {
        const railChapter = chapter as StepRailChapter;
        onSelect?.(railChapter);
      }}
    />
  );
};

export default ChatStepRail;
