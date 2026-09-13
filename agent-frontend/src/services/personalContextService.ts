import type { PersonalContextSettings } from '../types/personalContext';
import { getApiBaseUrl, type ApiResponse } from './api';

async function request(path = '', init?: RequestInit): Promise<PersonalContextSettings> {
  const response = await fetch(`${getApiBaseUrl()}/agent/personal-context${path}`, {
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });
  if (!response.ok) throw new Error(`个人上下文请求失败：HTTP ${response.status}`);
  const json = await response.json() as ApiResponse<PersonalContextSettings>;
  if (json.code !== 200 || !json.data) throw new Error(json.message || '个人上下文请求失败');
  return json.data;
}

export const fetchPersonalContext = () => request();

export const updatePersonalContextProfile = (profile: string) => request('/profile', {
  method: 'PUT',
  body: JSON.stringify({ profile }),
});

export const updatePersonalContextEnabled = (enabled: boolean) => request('/enabled', {
  method: 'PUT',
  body: JSON.stringify({ enabled }),
});

export const clearPersonalContextProfile = () => request('/profile', { method: 'DELETE' });
