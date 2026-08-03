import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ModelProvider, ModelItem } from '../types/model';
import { DEFAULT_PROVIDERS } from '../services/modelPreset';

interface ModelContextType {
  providers: ModelProvider[];
  activeProviderId: string;
  activeModelId: string;
  temperature: number;
  maxTokens: number;
  setActiveProviderId: (id: string) => void;
  setActiveModelId: (id: string) => void;
  setTemperature: (temp: number) => void;
  setMaxTokens: (tokens: number) => void;
  updateProvider: (providerId: string, updates: Partial<ModelProvider>) => void;
  addCustomProvider: (provider: Omit<ModelProvider, 'id'>) => void;
  addModelToProvider: (providerId: string, model: Omit<ModelItem, 'providerId'>) => void;
  removeModelFromProvider: (providerId: string, modelId: string) => void;
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
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved providers', e);
      }
    }
    return DEFAULT_PROVIDERS;
  });

  const [activeProviderId, setActiveProviderId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_PROVIDER) || 'deepseek';
  });

  const [activeModelId, setActiveModelId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_MODEL) || 'deepseek-reasoner';
  });

  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(4096);

  // Persist providers
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PROVIDERS, JSON.stringify(providers));
  }, [providers]);

  // Persist active selections
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ACTIVE_PROVIDER, activeProviderId);
  }, [activeProviderId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ACTIVE_MODEL, activeModelId);
  }, [activeModelId]);

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

  const testConnection = async (providerId: string): Promise<{ success: boolean; message: string }> => {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return { success: false, message: '未找到指定 Provider' };

    if (!provider.apiKey && provider.type !== 'ollama') {
      return { success: false, message: '请先填写 API Key' };
    }

    try {
      // Direct REST fetch test to models endpoint
      const res = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
        },
      });

      if (res.ok || res.status === 404 /* some standard endpoints return 404 for /models but API is active */) {
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
        setTemperature,
        setMaxTokens,
        updateProvider,
        addCustomProvider,
        addModelToProvider,
        removeModelFromProvider,
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
