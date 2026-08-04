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

const API_BASE_URL = 'http://localhost:8081';

/**
 * 获取当前模型配置
 */
export async function fetchModelConfig(): Promise<ModelConfig | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/agent/model/config`);
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
    const res = await fetch(`${API_BASE_URL}/agent/model/full-config`);
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
    const res = await fetch(`${API_BASE_URL}/agent/model/full-config`, {
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
    const res = await fetch(`${API_BASE_URL}/agent/model/vendors`);
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
    const res = await fetch(`${API_BASE_URL}/agent/model`, {
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

/**
 * Agent 对话流式 SSE 交互函数
 * 利用 fetch + ReadableStream 实时解析后端推流
 */
export async function streamAgentChat(
  params: { sessionId: string; context: string },
  onChunk: (text: string) => void,
  onComplete?: () => void,
  onError?: (err: any) => void
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/agent/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`HTTP 响应异常: Status ${response.status}`);
    }

    if (!response.body) {
      throw new Error('ReadableStream 不可用');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (onComplete) onComplete();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留未完整的行

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          const dataText = trimmed.substring(5).trim();
          if (dataText) {
            onChunk(dataText);
          }
        }
      }
    }
  } catch (err: any) {
    console.error('SSE 流数据解析失败:', err);
    if (onError) onError(err);
  }
}
