import type { UsagePurpose, UsageStatus } from './chat';
import type { InputTokenBreakdown, ToolTokenUsage } from './chat';

export interface TokenUsageTotals {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  totalTokens: number;
  durationMillis: number;
  turnCount: number;
  trackedTurnCount: number;
  modelCallCount: number;
  reportedCallCount: number;
  status: UsageStatus;
}

export interface TokenUsagePurposeBreakdown {
  purpose: UsagePurpose;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  modelCallCount: number;
  reportedCallCount: number;
}

export interface TokenUsageModelBreakdown {
  vendor: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  modelCallCount: number;
  reportedCallCount: number;
}

export interface DailyTokenUsage {
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  modelCallCount: number;
}

export interface TokenUsageOverview {
  from: string | null;
  to: string | null;
  sessionId: string | null;
  totals: TokenUsageTotals;
  breakdown: InputTokenBreakdown & { estimatedInputTokens: number };
  byTool: ToolTokenUsage[];
  byPurpose: TokenUsagePurposeBreakdown[];
  byModel: TokenUsageModelBreakdown[];
  daily: DailyTokenUsage[];
}
