import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findSlashCommand,
  parseSlashCommand,
  suggestSlashCommands,
  validateSlashCommandRegistry,
} from './slashCommands.ts';

test('解析命令名称和参数，并统一转为小写', () => {
  assert.deepEqual(parseSlashCommand(' /Rename  新会话名称 '), { name: 'rename', args: '新会话名称' });
  assert.deepEqual(parseSlashCommand('/'), { name: '', args: '' });
});

test('普通文本、转义命令和绝对路径不会被命令系统拦截', () => {
  assert.equal(parseSlashCommand('普通问题'), null);
  assert.equal(parseSlashCommand('//help'), null);
  assert.equal(parseSlashCommand('/Users/example/project'), null);
});

test('命令建议支持名称和别名，并在参数阶段关闭', () => {
  assert.deepEqual(suggestSlashCommands('/').map((command) => command.name), ['help', 'rename', 'status', 'tokens', 'today', 'ask-record']);
  assert.deepEqual(suggestSlashCommands('/u').map((command) => command.name), ['tokens']);
  assert.deepEqual(suggestSlashCommands('/rename 新名称'), []);
  assert.equal(findSlashCommand('usage')?.name, 'tokens');
});

test('今日汇总命令不接收参数', () => {
  assert.equal(findSlashCommand('today')?.requiresArgs, undefined);
  assert.deepEqual(suggestSlashCommands('/to').map((command) => command.name), ['tokens', 'today']);
});

test('资料问答命令声明引用选择器用法', () => {
  assert.equal(findSlashCommand('ask-record')?.usage, '/ask-record ? <问题>');
});

test('注册阶段拒绝命令名或别名冲突', () => {
  assert.throws(() => validateSlashCommandRegistry([
    { name: 'help', aliases: ['h'], description: '', usage: '' },
    { name: 'status', aliases: ['h'], description: '', usage: '' },
  ]), /名称冲突/);
});
