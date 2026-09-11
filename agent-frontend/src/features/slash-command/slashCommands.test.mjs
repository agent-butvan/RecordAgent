import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findSlashCommand,
  asRecordReferenceCommand,
  parseSlashCommand,
  parseRecordReferencePickerQuery,
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
  assert.deepEqual(suggestSlashCommands('/').map((command) => command.name), [
    'help', 'rename', 'status', 'tokens', 'today', 'agenda', 'spending', 'study-report', 'find-record', 'ask-record',
    'summarize-record', 'compare-records',
    'daily-review', 'weekly-review', 'todo-review', 'finance-review', 'study-review', 'study-plan',
  ]);
  assert.deepEqual(suggestSlashCommands('/u').map((command) => command.name), ['tokens']);
  assert.deepEqual(suggestSlashCommands('/rename 新名称'), []);
  assert.equal(findSlashCommand('usage')?.name, 'tokens');
});

test('今日汇总命令不接收参数', () => {
  assert.equal(findSlashCommand('today')?.requiresArgs, undefined);
  assert.deepEqual(suggestSlashCommands('/to').map((command) => command.name), ['tokens', 'today', 'todo-review']);
});

test('资料检索声明必填关键词，其余数据命令接受可选范围', () => {
  assert.equal(findSlashCommand('find-record')?.requiresArgs, true);
  assert.equal(findSlashCommand('agenda')?.requiresArgs, undefined);
  assert.equal(findSlashCommand('spending')?.requiresArgs, undefined);
  assert.equal(findSlashCommand('study-report')?.requiresArgs, undefined);
});

test('资料 AI 命令声明引用选择器用法和稳定的引用数量', () => {
  assert.equal(findSlashCommand('ask-record')?.usage, '/ask-record ? <问题>');
  assert.equal(findSlashCommand('summarize-record')?.usage, '/summarize-record ?');
  assert.equal(findSlashCommand('compare-records')?.usage, '/compare-records ? ?');
  assert.equal(asRecordReferenceCommand('ask-record'), 'ask-record');
  assert.equal(asRecordReferenceCommand('status'), null);
  assert.equal(parseRecordReferencePickerQuery('/ask-record ? 架构', 0), '架构');
  assert.equal(parseRecordReferencePickerQuery('/compare-records ? ?', 0), '');
  assert.equal(parseRecordReferencePickerQuery('/compare-records ?', 1), '');
  assert.equal(parseRecordReferencePickerQuery('/compare-records ?', 2), null);
});

test('注册阶段拒绝命令名或别名冲突', () => {
  assert.throws(() => validateSlashCommandRegistry([
    { name: 'help', aliases: ['h'], description: '', usage: '', execution: 'LOCAL' },
    { name: 'status', aliases: ['h'], description: '', usage: '', execution: 'LOCAL' },
  ]), /名称冲突/);
});

test('命令注册表区分本地、确定性查询和模型上下文命令', () => {
  assert.equal(findSlashCommand('status')?.execution, 'LOCAL');
  assert.equal(findSlashCommand('today')?.execution, 'QUERY');
  assert.equal(findSlashCommand('daily-review')?.execution, 'CONTEXT_PROMPT');
});

test('面板命令立即执行，Prompt 命令携带独立图标与颜色进入编辑态', () => {
  assert.equal(findSlashCommand('help')?.presentation.selection, 'IMMEDIATE');
  assert.equal(findSlashCommand('today')?.presentation.selection, 'IMMEDIATE');
  assert.equal(findSlashCommand('ask-record')?.presentation.selection, 'COMPOSE');
  assert.equal(findSlashCommand('study-review')?.presentation.icon, 'study');
  assert.match(findSlashCommand('study-review')?.presentation.color ?? '', /^#[0-9a-f]{6}$/i);
});
