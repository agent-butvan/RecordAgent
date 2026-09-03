#!/usr/bin/env node

/**
 * 桌面端版本的单一来源维护工具。
 *
 * VERSION 是唯一可手工编辑的版本文件；本脚本将其同步到前端包与
 * Tauri 配置，或在 --check 模式下阻止不一致的构建与发布。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const versionFile = path.join(rootDir, 'VERSION');
const packageFile = path.join(rootDir, 'agent-frontend', 'package.json');
const tauriConfigFile = path.join(rootDir, 'agent-frontend', 'src-tauri', 'tauri.conf.json');
const argumentsList = process.argv.slice(2);
const checkOnly = argumentsList.includes('--check');

if (argumentsList.some((argument) => !['--check', '--help'].includes(argument))) {
  throw new Error('用法：node scripts/sync-version.mjs [--check]');
}

if (argumentsList.includes('--help')) {
  console.log('用法：node scripts/sync-version.mjs [--check]');
  process.exit(0);
}

const version = (await readFile(versionFile, 'utf8')).trim();
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`VERSION 必须是 SemVer 版本号，当前值为：${JSON.stringify(version)}`);
}

const packageJson = JSON.parse(await readFile(packageFile, 'utf8'));
const tauriConfig = JSON.parse(await readFile(tauriConfigFile, 'utf8'));
const mismatches = [
  ['agent-frontend/package.json', packageJson.version],
  ['agent-frontend/src-tauri/tauri.conf.json', tauriConfig.version],
].filter(([, actual]) => actual !== version);

if (checkOnly) {
  if (mismatches.length > 0) {
    const details = mismatches.map(([file, actual]) => `${file}=${actual}`).join(', ');
    throw new Error(`版本不一致：VERSION=${version}，${details}。请执行 node scripts/sync-version.mjs。`);
  }
  console.log(`版本校验通过：${version}`);
  process.exit(0);
}

packageJson.version = version;
tauriConfig.version = version;
await Promise.all([
  writeFile(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`),
  writeFile(tauriConfigFile, `${JSON.stringify(tauriConfig, null, 2)}\n`),
]);
console.log(`已同步桌面端版本：${version}`);
