import { useCallback, useEffect, useRef, useState } from 'react';

/** 卡片独立加载；忽略卸载、日期切换和较早请求的结果，保留刷新中的已有内容。 */
export function useOverviewResource<T>(load: () => Promise<T>, refreshKey: string | number = 0) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestState = useRef({ generation: 0 }).current;
  const reload = useCallback(async () => {
    const current = ++requestState.generation;
    setError(null);
    try {
      const next = await load();
      if (current === requestState.generation) setData(next);
    } catch (cause) {
      if (current === requestState.generation) setError(cause instanceof Error ? cause.message : '加载失败，请重试。');
    } finally {
      if (current === requestState.generation) setLoading(false);
    }
  }, [load, requestState]);
  useEffect(() => {
    setData(null);
    setLoading(true);
    void reload();
    const refresh = () => { if (document.visibilityState === 'visible') void reload(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      requestState.generation++;
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [reload, refreshKey, requestState]);
  return { data, loading, error, reload };
}
