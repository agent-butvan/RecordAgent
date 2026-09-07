package butvan.agent.agents.usage;

import io.agentscope.core.model.ChatUsage;

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

    /** 将 AgentScope 标准用量转换为稳定领域对象；缺失数据保持不可用。 */
    public static ModelInvocationUsage fromProvider(
            String invocationId,
            String source,
            UsagePurpose purpose,
            ModelIdentity modelIdentity,
            ChatUsage usage
    ) {
        ModelIdentity identity = modelIdentity == null
                ? new ModelIdentity(null, null)
                : modelIdentity;
        if (usage == null) {
            return new ModelInvocationUsage(
                    invocationId, source, purpose, identity.vendor(), identity.model(),
                    null, null, null, null, null, UsageStatus.UNAVAILABLE
            );
        }
        long inputTokens = Math.max(0L, usage.getInputTokens());
        long outputTokens = Math.max(0L, usage.getOutputTokens());
        long cachedInputTokens = Math.min(inputTokens, Math.max(0L, usage.getCachedTokens()));
        double reportedSeconds = usage.getTime();
        Long durationMillis = Double.isFinite(reportedSeconds)
                ? Math.max(0L, Math.round(reportedSeconds * 1000D))
                : null;
        return new ModelInvocationUsage(
                invocationId,
                source,
                purpose,
                identity.vendor(),
                identity.model(),
                inputTokens,
                outputTokens,
                cachedInputTokens,
                inputTokens + outputTokens,
                durationMillis,
                UsageStatus.COMPLETE
        );
    }
}
