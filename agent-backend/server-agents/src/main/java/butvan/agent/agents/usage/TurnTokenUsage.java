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
        List<ModelInvocationUsage> calls
) {

    public TurnTokenUsage {
        calls = calls == null ? List.of() : List.copyOf(calls);
    }
}
