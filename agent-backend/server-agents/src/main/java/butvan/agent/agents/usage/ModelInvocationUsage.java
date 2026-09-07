package butvan.agent.agents.usage;

/** 一次真实 LLM 请求的供应商上报用量。 */
public record ModelInvocationUsage(
        String invocationId,
        String source,
        UsagePurpose purpose,
        String vendor,
        String model,
        Long inputTokens,
        Long outputTokens,
        Long cachedInputTokens,
        Long totalTokens,
        Long durationMillis,
        UsageStatus status
) {
}
