import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSlashStatusData } from './slashCommandStatus.ts';

const baseInput = {
  sessionId: 'session-12345678',
  sessionTitle: '实时状态',
  messages: [],
  activeProvider: { id: 'provider', name: 'Provider', type: 'custom', apiKey: '', isEnabled: true, models: [] },
  activeModel: { id: 'model', name: 'Model', providerId: 'provider', contextWindow: 128_000 },
  permissionMode: 'ASK',
  isSessionStreaming: false,
  isWaitingForPermission: false,
};

test('/status 每次使用最新会话数据重新派生 Token 和运行状态', () => {
  const initial = buildSlashStatusData(baseInput);
  const updated = buildSlashStatusData({
    ...baseInput,
    isSessionStreaming: true,
    sessionUsageSummary: {
      inputTokens: 100,
      outputTokens: 20,
      cachedInputTokens: 0,
      totalTokens: 120,
      turnCount: 1,
      trackedTurnCount: 1,
      modelCallCount: 1,
      reportedCallCount: 1,
      status: 'COMPLETE',
    },
    messages: [{
      id: 'assistant-1',
      role: 'assistant',
      content: '完成',
      createdAt: 1,
      usage: {
        inputTokens: 100,
        outputTokens: 20,
        cachedInputTokens: 0,
        totalTokens: 120,
        modelCallCount: 1,
        reportedCallCount: 1,
        status: 'COMPLETE',
        estimatedInputTokens: 96,
        breakdown: {
          systemPromptTokens: 10,
          historyTokens: 60,
          currentUserTokens: 10,
          toolSchemaTokens: 16,
          toolResultTokens: 0,
          profileContextTokens: 0,
          memoryRecallTokens: 0,
          ragContextTokens: 0,
          otherTokens: 0,
        },
        toolUsages: [],
        durationMillis: 100,
        calls: [{
          invocationId: 'call-1',
          modelCallIndex: 1,
          source: 'main',
          purpose: 'CHAT',
          vendor: 'provider',
          model: 'model',
          inputTokens: 100,
          outputTokens: 20,
          cachedInputTokens: 0,
          totalTokens: 120,
          durationMillis: 100,
          status: 'COMPLETE',
          tokenCounterId: 'test',
          estimatedInputTokens: 96,
          breakdown: {
            systemPromptTokens: 10,
            historyTokens: 60,
            currentUserTokens: 10,
            toolSchemaTokens: 16,
            toolResultTokens: 0,
            profileContextTokens: 0,
            memoryRecallTokens: 0,
            ragContextTokens: 0,
            otherTokens: 0,
          },
          toolUsages: [],
        }],
      },
    }],
  });

  assert.equal(initial.totalTokens, 0);
  assert.equal(initial.runtimeState, '空闲');
  assert.equal(updated.totalTokens, 120);
  assert.equal(updated.contextTokens, 100);
  assert.equal(updated.runtimeState, '运行中');
});
