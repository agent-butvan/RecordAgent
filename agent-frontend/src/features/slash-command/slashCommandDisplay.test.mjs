import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSlashCommandDisplayArguments } from './slashCommandDisplay.ts';

test('资料命令消息拆分引用标签和用户 Prompt', () => {
  assert.deepEqual(
    parseSlashCommandDisplayArguments('[资料：Spring Bean 生命周期] 这篇文章说了什么？'),
    { prompt: '这篇文章说了什么？', referenceTitles: ['Spring Bean 生命周期'] },
  );
});

test('对比命令支持恢复多个资料标签，普通参数保持原样', () => {
  assert.deepEqual(parseSlashCommandDisplayArguments('[资料：文章一；资料：文章二]'), {
    prompt: '',
    referenceTitles: ['文章一', '文章二'],
  });
  assert.deepEqual(parseSlashCommandDisplayArguments('week [数据：学习统计与记录]'), {
    prompt: 'week [数据：学习统计与记录]',
    referenceTitles: [],
  });
});
