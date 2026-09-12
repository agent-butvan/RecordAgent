import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applySlashCommandPreferences,
  resetSlashCommandDetails,
  setSlashCommandDetails,
  setSlashCommandEnabled,
} from './slashCommandPreferences.ts';
import { findSlashCommand, getSlashCommandStates, SLASH_COMMANDS } from './slashCommands.ts';

test('默认情况下所有内置命令均启用且使用 Registry 信息', () => {
  const states = applySlashCommandPreferences(SLASH_COMMANDS, {});
  assert.equal(states.length, SLASH_COMMANDS.length);
  assert.ok(states.every((state) => state.enabled));
  assert.equal(states[0].command.description, SLASH_COMMANDS[0].description);
});

test('偏好可以禁用命令并覆盖帮助信息，但不修改内置 Registry', () => {
  const states = applySlashCommandPreferences(SLASH_COMMANDS, {
    help: {
      enabled: false,
      description: '自定义帮助说明',
      usage: '/help [name]',
    },
  });
  const help = states.find((state) => state.command.name === 'help');
  assert.equal(help?.enabled, false);
  assert.equal(help?.customized, true);
  assert.equal(help?.command.description, '自定义帮助说明');
  assert.equal(help?.command.usage, '/help [name]');
  assert.notEqual(SLASH_COMMANDS[0].description, '自定义帮助说明');
});

test('本地偏好即时影响运行时命令，并可单独恢复帮助信息', () => {
  const values = new Map();
  const previousStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  });

  try {
    setSlashCommandEnabled('help', false);
    setSlashCommandDetails('help', { description: '本地帮助', usage: '/help local' });
    assert.equal(findSlashCommand('help'), undefined);
    assert.equal(getSlashCommandStates().find((state) => state.command.name === 'help')?.command.description, '本地帮助');

    resetSlashCommandDetails('help');
    const restored = getSlashCommandStates().find((state) => state.command.name === 'help');
    assert.equal(restored?.enabled, false);
    assert.equal(restored?.customized, false);
    assert.equal(restored?.command.description, SLASH_COMMANDS[0].description);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previousStorage });
  }
});
