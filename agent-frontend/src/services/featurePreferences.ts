import type { FeaturePreferences, StudyWindowMode } from '../types/preferences';

const STORAGE_KEY = 'butvan.featurePreferences';
export const FEATURE_PREFERENCES_EVENT = 'butvan:feature-preferences-changed';

const DEFAULT_PREFERENCES: FeaturePreferences = {
  studyWindowMode: 'page',
};

function isStudyWindowMode(value: unknown): value is StudyWindowMode {
  return value === 'page' || value === 'in-app' || value === 'desktop';
}

/** 读取本机功能偏好；损坏或过期的数据自动回退为安全默认值。 */
export function getFeaturePreferences(): FeaturePreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<FeaturePreferences>;
    return {
      studyWindowMode: isStudyWindowMode(saved.studyWindowMode)
        ? saved.studyWindowMode
        : DEFAULT_PREFERENCES.studyWindowMode,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** 保存功能偏好，并通知当前应用窗口内的订阅者即时更新。 */
export function setStudyWindowMode(studyWindowMode: StudyWindowMode): FeaturePreferences {
  const next = { ...getFeaturePreferences(), studyWindowMode };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent<FeaturePreferences>(FEATURE_PREFERENCES_EVENT, { detail: next }));
  return next;
}

export function subscribeFeaturePreferences(listener: (preferences: FeaturePreferences) => void): () => void {
  const onCustomEvent = (event: Event) => {
    listener((event as CustomEvent<FeaturePreferences>).detail);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener(getFeaturePreferences());
  };
  window.addEventListener(FEATURE_PREFERENCES_EVENT, onCustomEvent);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(FEATURE_PREFERENCES_EVENT, onCustomEvent);
    window.removeEventListener('storage', onStorage);
  };
}
