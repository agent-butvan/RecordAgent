export type ProviderType = 'gemini' | 'deepseek' | 'openai' | 'anthropic' | 'ollama' | 'qwen' | 'zhipu' | 'custom';

export interface ModelItem {
  id: string;
  name: string;
  providerId: string;
  description?: string;
  supportsReasoning?: boolean;
  contextWindow?: number;
  maxTokens?: number;
}

export interface ModelProvider {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl?: string;
  apiKey: string;
  isEnabled: boolean;
  isOfficial?: boolean;
  models: ModelItem[];
}

export interface ModelConfigState {
  providers: ModelProvider[];
  activeProviderId: string;
  activeModelId: string;
  temperature: number;
  maxTokens: number;
}
