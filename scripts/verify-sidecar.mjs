#!/usr/bin/env node

/**
 * 启动已生成的后端 sidecar，并验证健康检查可用。
 * 在本地或 CI 的 Tauri 构建后运行，确保 jar、jlink 运行时及启动器可协同工作。
 */
import { createServer } from 'node:net';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const binariesDir = path.join(rootDir, 'agent-frontend', 'src-tauri', 'binaries');
const timeoutMs = 60_000;

function hostTargetTriple() {
  const result = spawnSync('rustc', ['-vV'], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`无法读取 Rust target triple：${result.stderr || result.error?.message || 'unknown error'}`);
  }
  const host = result.stdout.match(/^host: (.+)$/m)?.[1];
  if (!host) throw new Error('rustc -vV 未返回 host target triple');
  return host;
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('无法分配测试端口');
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

function stopProcess(child) {
  if (child.exitCode !== null) return;
  child.kill();
  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
  }
}

const targetTriple = hostTargetTriple();
const extension = process.platform === 'win32' ? '.exe' : '';
const launcher = path.join(binariesDir, `butvan-backend-${targetTriple}${extension}`);
await access(launcher, constants.X_OK);
await access(path.join(binariesDir, 'butvan-backend.jar'), constants.R_OK);
await access(path.join(binariesDir, 'butvan-backend-runtime', 'bin', extension ? 'java.exe' : 'java'), constants.X_OK);

const port = await reservePort();
let output = '';
const child = spawn(launcher, [`--server.port=${port}`, '--server.address=127.0.0.1'], {
  cwd: binariesDir,
  stdio: ['ignore', 'pipe', 'pipe'],
});
for (const stream of [child.stdout, child.stderr]) {
  stream?.on('data', (chunk) => {
    output = `${output}${chunk}`.slice(-6_000);
  });
}

try {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  let ready = false;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`sidecar 提前退出，exitCode=${child.exitCode}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      const body = await response.json();
      if (response.ok && body.code === 200) {
        ready = true;
        break;
      }
      lastError = `HTTP ${response.status}: ${JSON.stringify(body)}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) {
    throw new Error(`sidecar 在 ${timeoutMs / 1000} 秒内未就绪：${lastError}`);
  }
  console.log(`sidecar 冒烟测试通过：http://127.0.0.1:${port}/api/health`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const log = output.trim();
  throw new Error(`${message}${log ? `\n--- sidecar 输出 ---\n${log}` : ''}`);
} finally {
  stopProcess(child);
}
