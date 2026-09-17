import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDirectRecordReferenceQuery } from './recordReferenceInput.ts';

test('半角问号直接打开资料引用并支持输入检索词', () => {
  assert.equal(parseDirectRecordReferenceQuery('?', 0), '');
  assert.equal(parseDirectRecordReferenceQuery('? AgentScope', 0), 'AgentScope');
});

test('普通问题、全角问号和已有引用不触发资料选择器', () => {
  assert.equal(parseDirectRecordReferenceQuery('这篇文章是什么？', 0), null);
  assert.equal(parseDirectRecordReferenceQuery('？', 0), null);
  assert.equal(parseDirectRecordReferenceQuery('?', 1), null);
});
