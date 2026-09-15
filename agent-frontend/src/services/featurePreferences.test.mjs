import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getFeaturePreferences,
  setChatTopBarPreference,
  setStudyWindowMode,
} from './featurePreferences.ts';

function withBrowserStorage(initialValue, run) {
  const values = new Map();
  if (initialValue !== undefined) values.set('butvan.featurePreferences', initialValue);
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { dispatchEvent: () => true },
  });
  try {
    run(values);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previousStorage });
    if (previousWindow === undefined) delete globalThis.window;
    else Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow });
  }
}

test('旧版偏好迁移时补齐聊天顶栏的安全默认值', () => {
  withBrowserStorage(JSON.stringify({ studyWindowMode: 'desktop' }), () => {
    assert.deepEqual(getFeaturePreferences(), {
      studyWindowMode: 'desktop',
      chatTopBar: { showDate: true, showTodos: true, showFinance: true, showHoliday: false, showWeather: false },
    });
  });
});

test('单项顶栏开关不会覆盖其他功能偏好', () => {
  withBrowserStorage(undefined, (values) => {
    setStudyWindowMode('in-app');
    const updated = setChatTopBarPreference('showFinance', false);
    assert.equal(updated.studyWindowMode, 'in-app');
    assert.deepEqual(updated.chatTopBar, { showDate: true, showTodos: true, showFinance: false, showHoliday: false, showWeather: false });
    assert.deepEqual(JSON.parse(values.get('butvan.featurePreferences')), updated);
  });
});

test('损坏的本地配置回退到完整默认值', () => {
  withBrowserStorage('{broken', () => {
    assert.deepEqual(getFeaturePreferences(), {
      studyWindowMode: 'page',
      chatTopBar: { showDate: true, showTodos: true, showFinance: true, showHoliday: false, showWeather: false },
    });
  });
});
