package butvan.agent.agents.usage;

import java.util.List;

/** 将多个轮次用量汇总为会话级快照，不读取文件或产生其他副作用。 */
public final class TokenUsageAggregator {

    private TokenUsageAggregator() {
    }

    /**
     * 聚合会话用量。
     *
     * @param turnCount 会话中的 assistant 轮次数，包含尚未接入统计的历史轮次
     * @param usages    已带用量字段的轮次
     * @return 会话级不可变汇总
     */
    public static TokenUsageSummary summarize(int turnCount, List<TurnTokenUsage> usages) {
        List<TurnTokenUsage> trackedUsages = usages == null ? List.of() : usages;
        long inputTokens = trackedUsages.stream().mapToLong(TurnTokenUsage::inputTokens).sum();
        long outputTokens = trackedUsages.stream().mapToLong(TurnTokenUsage::outputTokens).sum();
        long cachedInputTokens = trackedUsages.stream().mapToLong(TurnTokenUsage::cachedInputTokens).sum();
        int modelCallCount = trackedUsages.stream().mapToInt(TurnTokenUsage::modelCallCount).sum();
        int reportedCallCount = trackedUsages.stream().mapToInt(TurnTokenUsage::reportedCallCount).sum();
        UsageStatus status = aggregateStatus(
                Math.max(0, turnCount),
                trackedUsages.size(),
                reportedCallCount,
                trackedUsages
        );
        return new TokenUsageSummary(
                inputTokens,
                outputTokens,
                cachedInputTokens,
                inputTokens + outputTokens,
                Math.max(0, turnCount),
                trackedUsages.size(),
                modelCallCount,
                reportedCallCount,
                status
        );
    }

    private static UsageStatus aggregateStatus(
            int turnCount,
            int trackedTurnCount,
            int reportedCallCount,
            List<TurnTokenUsage> usages
    ) {
        if (turnCount == 0 || reportedCallCount == 0) return UsageStatus.UNAVAILABLE;
        boolean allComplete = trackedTurnCount == turnCount
                && usages.stream().allMatch(usage -> usage.status() == UsageStatus.COMPLETE);
        return allComplete ? UsageStatus.COMPLETE : UsageStatus.PARTIAL;
    }
}
