package butvan.agent.agents.usage;

import java.util.List;

/** 同一 turnId 下全部模型调用的 Token 用量快照。 */
public record TurnTokenUsage(
        long inputTokens,
        long outputTokens,
        long cachedInputTokens,
        long totalTokens,
        int modelCallCount,
        int reportedCallCount,
        UsageStatus status,
        List<ModelInvocationUsage> calls,
        long estimatedInputTokens,
        Long estimationDeltaTokens,
        InputTokenBreakdown breakdown,
        List<ToolTokenUsage> toolUsages,
        long durationMillis
) {

    public TurnTokenUsage {
        calls = calls == null ? List.of() : List.copyOf(calls);
        estimatedInputTokens = Math.max(0, estimatedInputTokens);
        breakdown = breakdown == null ? InputTokenBreakdown.empty() : breakdown;
        toolUsages = toolUsages == null ? List.of() : List.copyOf(toolUsages);
        durationMillis = Math.max(0, durationMillis);
    }

    /** 兼容历史调用点和旧测试数据。 */
    public TurnTokenUsage(
            long inputTokens,
            long outputTokens,
            long cachedInputTokens,
            long totalTokens,
            int modelCallCount,
            int reportedCallCount,
            UsageStatus status,
            List<ModelInvocationUsage> calls
    ) {
        this(inputTokens, outputTokens, cachedInputTokens, totalTokens, modelCallCount,
                reportedCallCount, status, calls, 0, null, InputTokenBreakdown.empty(), List.of(), 0);
    }
}
