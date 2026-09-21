import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectLanguage,
  resolveLanguage,
  getLanguageDisplayName,
  parseLanguageAndFilename,
} from './codeBlockLanguages.ts';

test('parseLanguageAndFilename: 正确解析携带前缀或文件名的语言字符串', () => {
  assert.deepEqual(parseLanguageAndFilename('python:app.py'), {
    language: 'python',
    filename: 'app.py',
  });

  assert.deepEqual(parseLanguageAndFilename('language-typescript'), {
    language: 'typescript',
    filename: undefined,
  });

  assert.deepEqual(parseLanguageAndFilename('.json'), {
    language: 'json',
    filename: undefined,
  });

  assert.deepEqual(parseLanguageAndFilename('bash', 'deploy.sh'), {
    language: 'bash',
    filename: 'deploy.sh',
  });
});

test('resolveLanguage: 别名统一与标准化', () => {
  assert.equal(resolveLanguage('py'), 'python');
  assert.equal(resolveLanguage('js'), 'javascript');
  assert.equal(resolveLanguage('ts'), 'typescript');
  assert.equal(resolveLanguage('sh'), 'bash');
  assert.equal(resolveLanguage('shell'), 'bash');
  assert.equal(resolveLanguage('golang'), 'go');
  assert.equal(resolveLanguage('c++'), 'cpp');
  assert.equal(resolveLanguage('c#'), 'csharp');
  assert.equal(resolveLanguage('cs'), 'csharp');
  assert.equal(resolveLanguage('yml'), 'yaml');
  assert.equal(resolveLanguage('md'), 'markdown');
  assert.equal(resolveLanguage('docker'), 'dockerfile');
});

test('detectLanguage: 未声明语言时的智能语法推断', () => {
  // JSON
  assert.equal(detectLanguage('{\n  "version": "1.0.0"\n}'), 'json');

  // Shell
  assert.equal(detectLanguage('npm install shiki\npnpm build'), 'bash');
  assert.equal(detectLanguage('#!/bin/bash\necho "hello"'), 'bash');

  // C / C++
  assert.equal(detectLanguage('int a = 0;'), 'c');
  assert.equal(detectLanguage('#include <iostream>\nusing namespace std;'), 'cpp');

  // Python
  assert.equal(detectLanguage('def calculate_sum(a, b):\n    return a + b'), 'python');
  assert.equal(detectLanguage('import os\nfrom pathlib import Path'), 'python');

  // SQL
  assert.equal(detectLanguage('SELECT id, name FROM users WHERE active = 1'), 'sql');

  // TSX / React
  assert.equal(detectLanguage('import React from "react";\nexport const Card = () => <div className="card">Hi</div>;'), 'tsx');

  // TypeScript
  assert.equal(detectLanguage('interface User {\n  id: string;\n  name: string;\n}'), 'typescript');

  // CSS
  assert.equal(detectLanguage('.btn-primary {\n  background-color: #2563eb;\n  color: #fff;\n}'), 'css');
});

test('getLanguageDisplayName: 友好展示名称映射', () => {
  assert.equal(getLanguageDisplayName('typescript'), 'TypeScript');
  assert.equal(getLanguageDisplayName('tsx'), 'TSX');
  assert.equal(getLanguageDisplayName('python'), 'Python');
  assert.equal(getLanguageDisplayName('bash'), 'Bash');
  assert.equal(getLanguageDisplayName('rust'), 'Rust');
  assert.equal(getLanguageDisplayName('go'), 'Go');
  assert.equal(getLanguageDisplayName('sql'), 'SQL');
  assert.equal(getLanguageDisplayName('json'), 'JSON');
});

test('createSmartLowlight: 针对未显式声明语言的代码优先触发启发式语法高亮', async () => {
  const { all, createLowlight } = await import('lowlight');
  const { createSmartLowlight, COMMON_CODE_LANGUAGES } = await import('./codeBlockLanguages.ts');

  assert.ok(COMMON_CODE_LANGUAGES.length > 10);
  assert.ok(COMMON_CODE_LANGUAGES.some((l) => l.value === 'java'));

  const base = createLowlight(all);
  const smart = createSmartLowlight(base);

  // 测试极简 Java 代码块推断并包含关键字 span
  const javaCode = 'public class Main {\n  public static void main(String[] args) {}\n}';
  const result = smart.highlightAuto(javaCode);
  assert.ok(result.children.length > 0);

  // 验证提取到了 hljs-keyword（public / class 等）
  const hasKeyword = result.children.some(
    (c) => c.type === 'element' && c.properties?.className?.includes('hljs-keyword')
  );
  assert.equal(hasKeyword, true);
});
