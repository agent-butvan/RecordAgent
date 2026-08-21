import type {
  SessionSummaryDto,
  SessionDetailDto,
  SessionKind,
} from '../types/chat';
import { invoke } from '@tauri-apps/api/core';

export interface ModelConfig {
  vendor: string;
  name: string;
  apiKey: string;
  temperature?: number;
  stream?: boolean;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/** 后端地址：浏览器/非 Tauri 环境回退到开发地址，Tauri 环境由 Rust 端动态注入 */
let apiBaseUrl = 'http://localhost:8081';

/** 判断当前是否运行在 Tauri 桌面端 */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * 初始化后端 API 地址
 *
 * 在 Tauri 环境轮询 Rust 端 `get_backend_port` 命令，等待后端 sidecar
 * 健康检查通过后写入动态端口；非 Tauri 环境保持开发地址不变。
 * 应在应用渲染前调用一次。
 */
export async function initApiBaseUrl(): Promise<void> {
  if (!isTauri()) return;

  // 开发模式：后端由开发者在本机（如 IDEA）启动，直接连固定开发端口
  const mode = await invoke<string>('get_backend_mode');
  if (mode === 'dev') return;

  // 最长等待 60 秒（后端启动通常需要数秒）
  for (let i = 0; i < 120; i++) {
    try {
      const port = await invoke<number | null>('get_backend_port');
      if (port) {
        apiBaseUrl = `http://127.0.0.1:${port}`;
        return;
      }
    } catch {
      // 命令尚未就绪，继续轮询
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/**
 * 获取当前模型配置
 */
export async function fetchModelConfig(): Promise<ModelConfig | null> {
  try {
    const res = await fetch(`${apiBaseUrl}/agent/model/config`);
    if (!res.ok) return null;
    const json: ApiResponse<ModelConfig> = await res.json();
    return json.data;
  } catch (err) {
    console.error('获取模型配置失败:', err);
    return null;
  }
}

/**
 * 获取全量多厂商模型配置
 */
export async function fetchFullModelConfig(): Promise<any | null> {
  try {
    const res = await fetch(`${apiBaseUrl}/agent/model/full-config`);
    if (!res.ok) return null;
    const json: ApiResponse<any> = await res.json();
    return json.data;
  } catch (err) {
    console.error('获取全量模型配置失败:', err);
    return null;
  }
}

/**
 * 保存全量多厂商模型配置
 */
export async function saveFullModelConfig(fullConfig: any): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${apiBaseUrl}/agent/model/full-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fullConfig),
    });
    const json: ApiResponse<string> = await res.json();
    if (res.ok && json.code === 200) {
      return { success: true, message: json.data || '全量模型配置保存成功！' };
    }
    return { success: false, message: json.message || '保存失败' };
  } catch (err: any) {
    return { success: false, message: err.message || '网络无法连接' };
  }
}

/**
 * 获取系统支持的供应商列表（从后端 yml 中拉取）
 */
export async function fetchSupportedVendors(): Promise<string[]> {
  try {
    const res = await fetch(`${apiBaseUrl}/agent/model/vendors`);
    if (!res.ok) return ['gemini', 'openai', 'dashscope', 'deepseek', 'anthropic', 'ollama'];
    const json: ApiResponse<string[]> = await res.json();
    return json.data || [];
  } catch (err) {
    console.error('获取供应商列表失败:', err);
    return ['gemini', 'openai', 'dashscope', 'deepseek', 'anthropic', 'ollama'];
  }
}

/**
 * 更新保存模型配置
 */
export async function saveModelConfig(params: {
  vendor: string;
  modelName: string;
  apiKey: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${apiBaseUrl}/agent/model`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    const json: ApiResponse<string> = await res.json();
    if (res.ok && json.code === 200) {
      return { success: true, message: json.data || '更新模型配置成功！' };
    }
    return { success: false, message: json.message || '更新配置失败' };
  } catch (err: any) {
    const errMsg = err?.message === 'Load failed' || err?.message === 'Failed to fetch'
      ? '后端网络请求被拒绝：请确认后端服务已启动且支持跨域访问'
      : (err.message || '无法连接至后端服务');
    return { success: false, message: errMsg };
  }
}

export interface ToolCallPayload {
  toolCallId?: string;
  toolName?: string;
  command?: string;
}

export interface ToolResultPayload {
  toolCallId?: string;
  toolName?: string;
  result?: string;
}

/** 后端要求用户确认时返回的单条高风险工具。 */
export interface PermissionToolPayload {
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
  riskDescription: string;
  index: number;
  total: number;
}

export interface PermissionRequiredPayload {
  approvalId: string;
  tool: PermissionToolPayload;
}

export interface PermissionDecisionResponse {
  readyToResume: boolean;
  nextTool: PermissionToolPayload | null;
}

/** 提交一条工具授权决定；本批全部完成时响应会标记 readyToResume。 */
export async function submitPermissionDecision(params: {
  sessionId: string;
  approvalId: string;
  toolCallId: string;
  approved: boolean;
  rememberForSession: boolean;
}): Promise<PermissionDecisionResponse> {
  const response = await fetch(`${apiBaseUrl}/agent/chat/permission/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    throw new Error(`提交权限决定失败：HTTP ${response.status}`);
  }
  return response.json() as Promise<PermissionDecisionResponse>;
}

/**
 * Agent 对话流式 SSE 交互函数
 * 利用 fetch + ReadableStream 实时解析后端推流
 */
export async function streamAgentChat(
  params: { sessionId: string; content?: string; context?: string; approvalId?: string },
  onChunk: (text: string) => void,
  onComplete?: () => void,
  onError?: (error: Error) => void,
  onToolCall?: (payload: ToolCallPayload) => void,
  onToolResult?: (payload: ToolResultPayload) => void,
  onThinking?: (thinkingText: string) => void,
  onPermissionRequired?: (payload: PermissionRequiredPayload) => void
): Promise<void> {
  try {
    const payloadContent = params.content || params.context || '';
    const isResume = Boolean(params.approvalId);
    const response = await fetch(
      `${apiBaseUrl}/agent/chat${isResume ? '/permission/resume' : '/stream'}`,
      {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
        body: JSON.stringify(isResume
          ? { sessionId: params.sessionId, approvalId: params.approvalId }
          : { sessionId: params.sessionId, context: payloadContent, content: payloadContent }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP 响应异常: Status ${response.status}`);
    }

    if (!response.body) {
      throw new Error('ReadableStream 不可用');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    let streamFinished = false;

    const dispatchSseEvent = (eventBlock: string) => {
      let eventName = 'message';
      const dataLines: string[] = [];

      for (const rawLine of eventBlock.split(/\r?\n/)) {
        if (rawLine.startsWith('event:')) {
          eventName = rawLine.substring(6).trim();
        } else if (rawLine.startsWith('data:')) {
          dataLines.push(rawLine.substring(5).trimStart());
        }
      }

      const dataStr = dataLines.join('\n');
      if (eventName === 'text' || eventName === 'message') {
        if (dataStr) onChunk(dataStr);
      } else if (eventName === 'thinking') {
        if (dataStr) onThinking?.(dataStr);
      } else if (eventName === 'tool_call') {
        try {
          const payload: ToolCallPayload = JSON.parse(dataStr);
          onToolCall?.(payload);
        } catch {
          onToolCall?.({ toolName: 'tool', command: dataStr });
        }
      } else if (eventName === 'tool_result') {
        try {
          const payload: ToolResultPayload = JSON.parse(dataStr);
          onToolResult?.(payload);
        } catch {
          onToolResult?.({ toolName: 'tool', result: dataStr });
        }
      } else if (eventName === 'permission_required') {
        streamFinished = true;
        try {
          onPermissionRequired?.(JSON.parse(dataStr) as PermissionRequiredPayload);
        } catch {
          onError?.(new Error('权限确认事件格式错误'));
        }
      } else if (eventName === 'error') {
        streamFinished = true;
        onError?.(new Error(dataStr || 'Agent 流式处理失败'));
      } else if (eventName === 'done') {
        streamFinished = true;
        onComplete?.();
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (buffer.trim()) dispatchSseEvent(buffer);
        if (!streamFinished) onComplete?.();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const eventBlocks = buffer.split(/\r?\n\r?\n/);
      buffer = eventBlocks.pop() || ''; // 保留尚未接收完整的 SSE 事件。

      for (const eventBlock of eventBlocks) {
        if (eventBlock.trim()) dispatchSseEvent(eventBlock);
      }
    }
  } catch (error: unknown) {
    console.error('SSE 流数据解析失败:', error);
    onError?.(error instanceof Error ? error : new Error('SSE 流数据解析失败'));
  }
}

/**
 * 获取后端会话摘要列表
 */
export async function fetchSessions(): Promise<SessionSummaryDto[]> {
  try {
    const res = await fetch(`${apiBaseUrl}/agent/sessions`);
    if (!res.ok) return [];
    const json: ApiResponse<SessionSummaryDto[]> = await res.json();
    return json.code === 200 && Array.isArray(json.data) ? json.data : [];
  } catch (err) {
    console.error('获取后端会话列表失败:', err);
    return [];
  }
}

/**
 * 获取会话详情（包含完整消息记录列表）
 */
export async function fetchSessionDetail(sessionId: string): Promise<SessionDetailDto | null> {
  try {
    const res = await fetch(`${apiBaseUrl}/agent/sessions/${sessionId}`);
    if (!res.ok) return null;
    const json: ApiResponse<SessionDetailDto> = await res.json();
    return json.code === 200 ? json.data : null;
  } catch (err) {
    console.error('获取会话详情失败:', err);
    return null;
  }
}

/**
 * 创建新会话（ID 由后端生成 UUID）
 */
export async function createSessionApi(params?: {
  kind?: SessionKind;
  title?: string;
}): Promise<{ success: boolean; data?: SessionSummaryDto; message?: string }> {
  try {
    const res = await fetch(`${apiBaseUrl}/agent/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: params?.kind || 'GENERAL',
        title: params?.title || '新对话',
      }),
    });
    const json: ApiResponse<SessionSummaryDto> = await res.json();
    if (res.ok && json.code === 200) {
      return { success: true, data: json.data };
    }
    return { success: false, message: json.message || '创建会话失败' };
  } catch (err: any) {
    console.error('创建会话 API 调用失败:', err);
    return { success: false, message: err?.message || '网络连接失败' };
  }
}

/**
 * 修改会话标题 (PATCH /agent/sessions/{sessionId})
 */
export async function updateSessionTitleApi(
  sessionId: string,
  title: string
): Promise<{ success: boolean; data?: SessionSummaryDto; message?: string }> {
  try {
    const res = await fetch(`${apiBaseUrl}/agent/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const json: ApiResponse<SessionSummaryDto> = await res.json();
    if (res.ok && json.code === 200) {
      return { success: true, data: json.data };
    }
    return { success: false, message: json.message || '更新标题失败' };
  } catch (err: any) {
    console.error('更新会话标题 API 调用失败:', err);
    return { success: false, message: err?.message || '网络连接失败' };
  }
}

/**
 * 删除会话 (DELETE /agent/sessions/{sessionId})
 */
export async function deleteSessionApi(sessionId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${apiBaseUrl}/agent/sessions/${sessionId}`, {
      method: 'DELETE',
    });
    const json: ApiResponse<void> = await res.json();
    if (res.ok && json.code === 200) {
      return { success: true };
    }
    return { success: false, message: json.message || '删除会话失败' };
  } catch (err: any) {
    console.error('删除会话 API 调用失败:', err);
    return { success: false, message: err?.message || '网络连接失败' };
  }
}

/** 读取当前会话的任务计划书（不存在时返回 null）。 */
export async function fetchPlan(sessionId: string): Promise<string | null> {
  try {
    const res = await fetch(`${apiBaseUrl}/agent/chat/${sessionId}/plan`);
    if (!res.ok) return null;
    const json = (await res.json()) as { content?: string };
    return json.content ?? null;
  } catch (err) {
    console.error('读取计划书失败:', err);
    return null;
  }
}
