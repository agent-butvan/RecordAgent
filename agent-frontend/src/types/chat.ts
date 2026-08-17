export type SessionKind = 'GENERAL' | 'PROJECT';
export type SessionStatus = 'ACTIVE' | 'DELETING';
export type MessageRole = 'USER' | 'ASSISTANT';
export type MessageStatus = 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface ToolExecution {
  toolCallId: string;
  toolName: string;
  command: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  output?: string;
}

export interface ChatMessage {
  id: string;
  turnId?: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  modelName?: string;
  createdAt: number;
  startTime?: number;
  elapsedTime?: number;
  status?: MessageStatus;
  tools?: ToolExecution[];
}

export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: number;
}

export interface SessionSummaryDto {
  id: string;
  kind: SessionKind;
  title: string;
  lastMessagePreview: string;
  createdAt: string;
  updatedAt: string;
  status: SessionStatus;
}

export interface TranscriptToolExecutionDto {
  toolCallId: string;
  toolName: string;
  command: string;
  output: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
}

export interface TranscriptMessageDto {
  id: string;
  turnId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  status: MessageStatus;
  durationMillis?: number | null;
  tools?: TranscriptToolExecutionDto[];
  thinking?: string | null;
}

export interface SessionDetailDto {
  summary: SessionSummaryDto;
  messages: TranscriptMessageDto[];
}

export interface ChatSession {
  id: string;
  kind: SessionKind;
  title: string;
  lastMessagePreview?: string;
  projectId?: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  isLoaded?: boolean; // 消息记录是否已从后端详情接口中全量加载
}

