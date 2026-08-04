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
    return { success: false, message: err.message || '无法连接至后端服务' };
  }
}
