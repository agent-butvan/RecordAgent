package butvan.agent.agents.usage;

/** 一个会话中全部聊天轮次的轻量 Token 汇总。 */
public record TokenUsageSummary(
        long inputTokens,
        long outputTokens,
        long cachedInputTokens,
        long totalTokens,
        int turnCount,
        int trackedTurnCount,
        int modelCallCount,
        int reportedCallCount,
        UsageStatus status
) {
}
