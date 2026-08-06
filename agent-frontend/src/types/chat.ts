export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  modelName?: string;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: number;
}

export interface ChatSession {
  id: string;
  title: string;
  projectId?: string; // 若为空则为普通独立会话，若有值则绑定对应项目
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

