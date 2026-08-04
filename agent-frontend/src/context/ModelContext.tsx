import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ModelProvider, ModelItem } from '../types/model';
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
  addModelItem: (params: {
    vendor: string;
    baseUrl: string;
    apiKey: string;
    modelId: string;
    name: string;
    description?: string;
    supportsReasoning?: boolean;
  }) => void;
  deleteModelItem: (providerId: string, modelId: string) => void;
  testConnectionByUrl: (baseUrl: string, apiKey: string, type: string) => Promise<{ success: boolean; message: string }>;
  getActiveModel: () => ModelItem | undefined;
  getActiveProvider: () => ModelProvider | undefined;
  getAllModels: () => (ModelItem & { providerName: string; providerType: string; baseUrl: string; apiKey: string })[];
}

const STORAGE_KEY_PROVIDERS = 'butvan_agent_providers_v2';
const STORAGE_KEY_ACTIVE_PROVIDER = 'butvan_agent_active_provider';
const STORAGE_KEY_ACTIVE_MODEL = 'butvan_agent_active_model';

const ModelContext = createContext<ModelContextType | undefined>(undefined);

export const ModelProviderContext: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [providers, setProviders] = useState<ModelProvider[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PROVIDERS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error('Failed to parse saved providers', e);
      }
    }
    return [];
  });

  const [activeProviderId, setActiveProviderId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_PROVIDER) || '';
  });

  const [activeModelId, setActiveModelId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_MODEL) || '';
  });

  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(4096);

  // 挂载时严格同步 backend config.json 真实数据
  useEffect(() => {
    const syncFromBackend = async () => {
      const fullConfig = await fetchFullModelConfig();
      if (fullConfig) {
        const actVendor = fullConfig.activeVendor || fullConfig.vendor || '';
        const actModel = fullConfig.activeModel || fullConfig.name || '';
        setActiveProviderId(actVendor);
        setActiveModelId(actModel);

        if (Array.isArray(fullConfig.providers)) {
          const loadedProviders: ModelProvider[] = fullConfig.providers.map((p: any) => ({
            id: p.id || p.type || p.vendor || 'custom',
            name: p.name || p.vendor || 'Custom Vendor',
            type: p.type || p.vendor || 'custom',
            baseUrl: p.baseUrl || '',
            apiKey: p.apiKey || '',
            isEnabled: p.isEnabled !== undefined ? p.isEnabled : true,
            models: Array.isArray(p.models)
              ? p.models.map((m: any) => ({
                  id: m.id || m.modelName,
                  name: m.name || m.modelName,
                  providerId: p.id || p.type || 'custom',
                  description: m.description || '',
                  supportsReasoning: !!m.supportsReasoning,
                }))
              : [],
          }));
          setProviders(loadedProviders);
        }
      }
    };
    syncFromBackend();
  }, []);

  // 变动时进行本地与后端持久化同步
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PROVIDERS, JSON.stringify(providers));
    localStorage.setItem(STORAGE_KEY_ACTIVE_PROVIDER, activeProviderId);
    localStorage.setItem(STORAGE_KEY_ACTIVE_MODEL, activeModelId);

    const activeProvider = providers.find((p) => p.id === activeProviderId || p.type === activeProviderId);
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

    const targetProvider = providers.find((p) => p.id === providerId || p.type === providerId);
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

  const addModelItem = (params: {
    vendor: string;
    baseUrl: string;
    apiKey: string;
    modelId: string;
    name: string;
    description?: string;
    supportsReasoning?: boolean;
  }) => {
    const { vendor, baseUrl, apiKey, modelId, name, description, supportsReasoning } = params;

    setProviders((prev) => {
      const existingProviderIndex = prev.findIndex((p) => p.id === vendor || p.type === vendor);
      const newModel: ModelItem = {
        id: modelId,
        name: name || modelId,
        providerId: vendor,
        description: description || '',
        supportsReasoning: !!supportsReasoning,
      };

      if (existingProviderIndex >= 0) {
        return prev.map((p, idx) => {
          if (idx === existingProviderIndex) {
            const existsModel = p.models.some((m) => m.id === modelId);
            const updatedModels = existsModel
              ? p.models.map((m) => (m.id === modelId ? newModel : m))
              : [...p.models, newModel];

            return {
              ...p,
              baseUrl: baseUrl || p.baseUrl,
              apiKey: apiKey !== undefined ? apiKey : p.apiKey,
              models: updatedModels,
            };
          }
          return p;
        });
      } else {
        const newProvider: ModelProvider = {
          id: vendor,
          name: vendor.toUpperCase(),
          type: vendor as any,
          baseUrl: baseUrl || '',
          apiKey: apiKey || '',
          isEnabled: true,
          models: [newModel],
        };
        return [...prev, newProvider];
      }
    });

    // 如果当前没有任何激活模型，自动将新增的模型设为激活模型
    if (!activeProviderId || !activeModelId) {
      setActiveProviderId(vendor);
      setActiveModelId(modelId);
    }
  };

  const deleteModelItem = (providerId: string, modelId: string) => {
    setProviders((prev) => {
      const updated = prev.map((p) => {
        if (p.id === providerId || p.type === providerId) {
          return {
            ...p,
            models: p.models.filter((m) => m.id !== modelId),
          };
        }
        return p;
      }).filter((p) => p.models.length > 0); // 移除没有模型的空 provider

      return updated;
    });

    if (activeProviderId === providerId && activeModelId === modelId) {
      const allLeft = getAllModels().filter((m) => !(m.providerId === providerId && m.id === modelId));
      if (allLeft.length > 0) {
        setActiveProviderId(allLeft[0].providerId);
        setActiveModelId(allLeft[0].id);
      } else {
        setActiveProviderId('');
        setActiveModelId('');
      }
    }
  };

  const testConnectionByUrl = async (baseUrl: string, apiKey: string, type: string): Promise<{ success: boolean; message: string }> => {
    if (!apiKey && type !== 'ollama') {
      return { success: false, message: '请先填写 API Key' };
    }

    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (res.ok || res.status === 404) {
        return { success: true, message: '连接成功！Endpoint 可达' };
      } else {
        return { success: false, message: `连接失败: HTTP Status ${res.status}` };
      }
    } catch (err: any) {
      return { success: false, message: `网络连接异常: ${err.message || '未知错误'}` };
    }
  };

  const getAllModels = () => {
    const list: (ModelItem & { providerName: string; providerType: string; baseUrl: string; apiKey: string })[] = [];
    providers.forEach((p) => {
      p.models.forEach((m) => {
        list.push({
          ...m,
          providerName: p.name || p.id,
          providerType: p.type || p.id,
          baseUrl: p.baseUrl || '',
          apiKey: p.apiKey || '',
        });
      });
    });
    return list;
  };

  const getActiveProvider = () => providers.find((p) => p.id === activeProviderId || p.type === activeProviderId);

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
        addModelItem,
        deleteModelItem,
        testConnectionByUrl,
        getActiveModel,
        getActiveProvider,
        getAllModels,
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
