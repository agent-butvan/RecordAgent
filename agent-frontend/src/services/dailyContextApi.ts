import { getApiBaseUrl, type ApiResponse } from './api';

export interface DailyContextConfig {
  qweatherApiHost: string;
  qweatherApiKeyConfigured: boolean;
  locationName: string;
  latitude: number | null;
  longitude: number | null;
  tianApiKeyConfigured: boolean;
}

export interface UpdateDailyContextConfig {
  qweatherApiHost: string;
  qweatherApiKey: string;
  clearQweatherApiKey: boolean;
  locationName: string;
  latitude: number | null;
  longitude: number | null;
  tianApiKey: string;
  clearTianApiKey: boolean;
}

export interface WeatherSummary {
  locationName: string;
  condition: string;
  conditionCode: string;
  temperature: number;
  temperatureUnit: string;
  feelsLike: number;
  humidityPercent: number;
  windDirection: string;
  windSpeed: number;
  windSpeedUnit: string;
  attributionUrl: string;
}

export interface HolidaySummary {
  name: string;
  description: string;
  dayCode: number;
  dayOff: boolean;
  wageMultiple: number;
  lunarDate: string;
  tip: string;
}

export interface DailyContextSummary {
  date: string;
  weather: WeatherSummary | null;
  holiday: HolidaySummary | null;
  weatherError: string | null;
  holidayError: string | null;
}

async function dailyContextRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(12_000),
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'TimeoutError') {
      throw new Error('天气与节假日服务响应超时，请稍后重试。');
    }
    throw cause;
  }
  let payload: ApiResponse<T>;
  try {
    payload = await response.json() as ApiResponse<T>;
  } catch {
    throw new Error(`天气与节假日服务返回了无法识别的响应（HTTP ${response.status}）`);
  }
  if (!response.ok || payload.code !== 200) {
    throw new Error(payload.message || `天气与节假日请求失败（HTTP ${response.status}）`);
  }
  return payload.data;
}

/** 获取不含密钥正文的供应商配置。 */
export function fetchDailyContextConfig(): Promise<DailyContextConfig> {
  return dailyContextRequest('/agent/daily-context/config');
}

/** 保存供应商与地点配置；空密钥由后端解释为保留已有值。 */
export function saveDailyContextConfig(input: UpdateDailyContextConfig): Promise<DailyContextConfig> {
  return dailyContextRequest('/agent/daily-context/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

/** 按需请求已启用的天气和节假日，未启用项不会访问第三方。 */
export function fetchDailyContextSummary(
  date: string,
  weather: boolean,
  holiday: boolean,
): Promise<DailyContextSummary> {
  const params = new URLSearchParams({ date, weather: String(weather), holiday: String(holiday) });
  return dailyContextRequest(`/agent/daily-context/summary?${params}`);
}
