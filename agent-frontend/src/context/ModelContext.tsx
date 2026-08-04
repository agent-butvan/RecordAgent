import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ModelProvider, ModelItem } from '../types/model';
import { DEFAULT_PROVIDERS } from '../services/modelPreset';
import { fetchFullModelConfig, saveFullModelConfig, saveModelConfig } from '../services/api';

interface ModelContextType {
  providers: ModelProvider[];
  activeProviderId: string;
  activeModelId: string;
  temperature: number;
  maxTokens: number;
  setActiveProviderId: (id: string) => void;
  setActiveModelId: (id: string) => void;
  selectActiveModel: (providerId: string, modelId: string) => Promise<void>;
  setTemperature: (temp: number) => void;
  setMaxTokens: (tokens: number) => void;
  updateProvider: (providerId: string, updates: Partial<ModelProvider>) => void;
  addCustomProvider: (provider: Omit<ModelProvider, 'id'>) => void;
  addModelToProvider: (providerId: string, model: Omit<ModelItem, 'providerId'>) => void;
  removeModelFromProvider: (providerId: string, modelId: string) => void;
  updateModelInProvider: (providerId: string, modelId: string, updates: Partial<ModelItem>) => void;
  testConnection: (providerId: string) => Promise<{ success: boolean; message: string }>;
  getActiveModel: () => ModelItem | undefined;
  getActiveProvider: () => ModelProvider | undefined;
}

const STORAGE_KEY_PROVIDERS = 'butvan_agent_providers_v1';
const STORAGE_KEY_ACTIVE_PROVIDER = 'butvan_agent_active_provider';
const STORAGE_KEY_ACTIVE_MODEL = 'butvan_agent_active_model';

const ModelContext = createContext<ModelContextType | undefined>(undefined);

export const ModelProviderContext: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [providers, setProviders] = useState<ModelProvider[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PROVIDERS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Failed to parse saved providers', e);
      }
    }
    return DEFAULT_PROVIDERS;
  });

  const [activeProviderId, setActiveProviderId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_PROVIDER) || 'gemini';
  });

  const [activeModelId, setActiveModelId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_MODEL) || 'gemini-2.5-flash';
  });

  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(4096);

  // 初始化从后端拉取全量配置
  useEffect(() => {
    const syncFromBackend = async () => {
      const fullConfig = await fetchFullModelConfig();
      if (fullConfig) {
        if (fullConfig.activeVendor) {
          setActiveProviderId(fullConfig.activeVendor);
        } else if (fullConfig.vendor) {
          setActiveProviderId(fullConfig.vendor);
        }

        if (fullConfig.activeModel) {
          setActiveModelId(fullConfig.activeModel);
        } else if (fullConfig.name) {
          setActiveModelId(fullConfig.name);
        }

        if (Array.isArray(fullConfig.providers) && fullConfig.providers.length > 0) {
          setProviders((prev) => {
            // 合并后端 providers 数据
            return DEFAULT_PROVIDERS.map((defaultP) => {
              const backendP = fullConfig.providers.find(
                (p: any) => p.id === defaultP.id || p.type === defaultP.type
              );
              if (backendP) {
                return {
                  ...defaultP,
                  baseUrl: backendP.baseUrl || defaultP.baseUrl,
                  apiKey: backendP.apiKey || defaultP.apiKey,
                  isEnabled: backendP.isEnabled !== undefined ? backendP.isEnabled : defaultP.isEnabled,
                  models: Array.isArray(backendP.models) && backendP.models.length > 0
                    ? backendP.models.map((m: any) => ({
                        id: m.id || m.modelName,
                        name: m.name || m.modelName,
                        providerId: defaultP.id,
                        description: m.description || '',
                        supportsReasoning: !!m.supportsReasoning,
                      }))
                    : defaultP.models,
                };
              }
              return defaultP;
            });
          });
        }
      }
    };
    syncFromBackend();
  }, []);

  // 持久化保存与同步
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PROVIDERS, JSON.stringify(providers));
    localStorage.setItem(STORAGE_KEY_ACTIVE_PROVIDER, activeProviderId);
    localStorage.setItem(STORAGE_KEY_ACTIVE_MODEL, activeModelId);

    // 结构化全量配置发往后端保存
    const activeProvider = providers.find((p) => p.id === activeProviderId);
    const activeApiKey = activeProvider?.apiKey || '';

    saveFullModelConfig({
      activeVendor: activeProviderId,
      activeModel: activeModelId,
      vendor: activeProviderId,
      name: activeModelId,
      apiKey: activeApiKey,
      temperature,
      stream: true,
      providers: providers.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        baseUrl: p.baseUrl,
        apiKey: p.apiKey,
        isEnabled: p.isEnabled,
        models: p.models.map((m) => ({
          id: m.id,
          name: m.name,
          modelName: m.id,
          providerId: p.id,
          description: m.description || '',
          supportsReasoning: !!m.supportsReasoning,
        })),
      })),
    });
  }, [providers, activeProviderId, activeModelId, temperature]);

  const selectActiveModel = async (providerId: string, modelId: string) => {
    setActiveProviderId(providerId);
    setActiveModelId(modelId);

    const targetProvider = providers.find((p) => p.id === providerId);
    if (targetProvider) {
      await saveModelConfig({
        vendor: providerId,
        modelName: modelId,
        apiKey: targetProvider.apiKey || '',
      });
    }
  };

  const updateProvider = (providerId: string, updates: Partial<ModelProvider>) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === providerId ? { ...p, ...updates } : p))
    );
  };

  const addCustomProvider = (providerData: Omit<ModelProvider, 'id'>) => {
    const newId = `custom-${Date.now()}`;
    const newProvider: ModelProvider = {
      ...providerData,
      id: newId,
    };
    setProviders((prev) => [...prev, newProvider]);
  };

  const addModelToProvider = (providerId: string, modelData: Omit<ModelItem, 'providerId'>) => {
    setProviders((prev) =>
      prev.map((p) => {
        if (p.id === providerId) {
          const newModel: ModelItem = {
            ...modelData,
            providerId,
          };
          return {
            ...p,
            models: [...p.models, newModel],
          };
        }
        return p;
      })
    );
  };

  const removeModelFromProvider = (providerId: string, modelId: string) => {
    setProviders((prev) =>
      prev.map((p) => {
        if (p.id === providerId) {
          return {
            ...p,
            models: p.models.filter((m) => m.id !== modelId),
          };
        }
        return p;
      })
    );
  };

  const updateModelInProvider = (providerId: string, modelId: string, updates: Partial<ModelItem>) => {
    setProviders((prev) =>
      prev.map((p) => {
        if (p.id === providerId) {
          return {
            ...p,
            models: p.models.map((m) => (m.id === modelId ? { ...m, ...updates } : m)),
          };
        }
        return p;
      })
    );
  };

  const testConnection = async (providerId: string): Promise<{ success: boolean; message: string }> => {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return { success: false, message: '未找到指定 Provider' };

    if (!provider.apiKey && provider.type !== 'ollama') {
      return { success: false, message: '请先填写 API Key' };
    }

    try {
      const res = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
        },
      });

      if (res.ok || res.status === 404) {
        return { success: true, message: '连接成功！Endpoint 可达' };
      } else {
        return { success: false, message: `连接失败: HTTP Status ${res.status}` };
      }
    } catch (err: any) {
      return { success: false, message: `网络连接异常或 CORS 拦截: ${err.message || '未知错误'}` };
    }
  };

  const getActiveProvider = () => providers.find((p) => p.id === activeProviderId);

  const getActiveModel = () => {
    const provider = getActiveProvider();
    return provider?.models.find((m) => m.id === activeModelId);
  };

  return (
    <ModelContext.Provider
      value={{
        providers,
        activeProviderId,
        activeModelId,
        temperature,
        maxTokens,
        setActiveProviderId,
        setActiveModelId,
        selectActiveModel,
        setTemperature,
        setMaxTokens,
        updateProvider,
        addCustomProvider,
        addModelToProvider,
        removeModelFromProvider,
        updateModelInProvider,
        testConnection,
        getActiveModel,
        getActiveProvider,
      }}
    >
      {children}
    </ModelContext.Provider>
  );
};

export const useModel = () => {
  const context = useContext(ModelContext);
  if (!context) {
    throw new Error('useModel must be used within a ModelProviderContext');
  }
  return context;
};
