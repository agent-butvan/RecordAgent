import type { ChatMessage, SessionPermissionMode, TokenUsageSummary } from '../../types/chat';
import type { ModelItem, ModelProvider } from '../../types/model';

export interface SlashStatusData {
  sessionId: string;
  sessionTitle: string;
  providerName: string;
  modelName: string;
  permissionMode: string;
  runtimeState: string;
  compactionState: string;
  totalTokens: number;
  contextTokens?: number;
  contextWindow?: number;
}

interface BuildSlashStatusDataInput {
  sessionId: string;
  sessionTitle: string;
  messages: ChatMessage[];
  sessionUsageSummary?: TokenUsageSummary;
  activeProvider?: ModelProvider;
  activeModel?: ModelItem;
  permissionMode: SessionPermissionMode;
  isSessionStreaming: boolean;
  isWaitingForPermission: boolean;
}

/** 从当前会话状态派生 /status 数据，避免面板保留执行命令时的静态快照。 */
export function buildSlashStatusData(input: BuildSlashStatusDataInput): SlashStatusData {
  const latestUsage = [...input.messages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.usage)?.usage;
  const latestCall = latestUsage?.calls.at(-1);

  return {
    sessionId: input.sessionId,
    sessionTitle: input.sessionTitle,
    providerName: input.activeProvider?.name || input.activeProvider?.id || '未配置',
    modelName: input.activeModel?.name || input.activeModel?.id || '未配置',
    permissionMode: input.permissionMode === 'ASK'
      ? '逐次询问'
      : input.permissionMode === 'AUTO_EDIT' ? '自动编辑' : '完全访问',
    runtimeState: input.isWaitingForPermission ? '等待权限确认' : input.isSessionStreaming ? '运行中' : '空闲',
    compactionState: '自动压缩已启用；最近一次压缩状态暂不可用',
    totalTokens: input.sessionUsageSummary?.totalTokens ?? 0,
    contextTokens: latestCall?.inputTokens ?? latestCall?.estimatedInputTokens,
    contextWindow: input.activeModel?.contextWindow,
  };
}
