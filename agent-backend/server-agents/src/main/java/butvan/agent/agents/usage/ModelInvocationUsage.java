package butvan.agent.agents.usage;

import io.agentscope.core.model.ChatUsage;

import java.util.List;

/** 一次真实 LLM 请求的供应商上报用量。 */
public record ModelInvocationUsage(
        String invocationId,
        int modelCallIndex,
        String source,
        UsagePurpose purpose,
        String vendor,
        String model,
        Long inputTokens,
        Long outputTokens,
        Long cachedInputTokens,
        Long totalTokens,
        Long durationMillis,
        UsageStatus status,
        String tokenCounterId,
        long estimatedInputTokens,
        Long estimationDeltaTokens,
        InputTokenBreakdown breakdown,
        List<ToolTokenUsage> toolUsages
) {

    public ModelInvocationUsage {
        modelCallIndex = Math.max(0, modelCallIndex);
        tokenCounterId = tokenCounterId == null || tokenCounterId.isBlank() ? "unknown" : tokenCounterId;
        estimatedInputTokens = Math.max(0, estimatedInputTokens);
        breakdown = breakdown == null ? InputTokenBreakdown.empty() : breakdown;
        toolUsages = toolUsages == null ? List.of() : List.copyOf(toolUsages);
    }

    /** 将 AgentScope 标准用量转换为稳定领域对象；缺失数据保持不可用。 */
    public static ModelInvocationUsage fromProvider(
            String invocationId,
            String source,
            UsagePurpose purpose,
            ModelIdentity modelIdentity,
            ChatUsage usage
    ) {
        return fromProvider(invocationId, 0, source, purpose, modelIdentity, usage, null);
    }

    /** 合并调用前估算和 Provider 最终 Usage。 */
    public static ModelInvocationUsage fromProvider(
            String invocationId,
            int modelCallIndex,
            String source,
            UsagePurpose purpose,
            ModelIdentity modelIdentity,
            ChatUsage usage,
            ModelInputEstimate estimate
    ) {
        ModelIdentity identity = modelIdentity == null
                ? new ModelIdentity(null, null)
                : modelIdentity;
        ModelInputEstimate effectiveEstimate = estimate == null
                ? new ModelInputEstimate("unknown", InputTokenBreakdown.empty(), List.of())
                : estimate;
        long estimatedInput = effectiveEstimate.breakdown().estimatedTokens();
        if (usage == null) {
            return new ModelInvocationUsage(
                    invocationId, modelCallIndex, source, purpose, identity.vendor(), identity.model(),
                    null, null, null, null, null, UsageStatus.UNAVAILABLE,
                    effectiveEstimate.counterId(), estimatedInput, null,
                    effectiveEstimate.breakdown(), effectiveEstimate.toolUsages()
            );
        }
        long inputTokens = Math.max(0L, usage.getInputTokens());
        long outputTokens = Math.max(0L, usage.getOutputTokens());
        long cachedInputTokens = Math.min(inputTokens, Math.max(0L, usage.getCachedTokens()));
        double reportedSeconds = usage.getTime();
        Long durationMillis = Double.isFinite(reportedSeconds)
                ? Math.max(0L, Math.round(reportedSeconds * 1000D))
                : null;
        long estimationDelta = inputTokens - estimatedInput;
        // 本地 tokenizer 可能略高于 Provider；Other 保持非负，原始有符号差值单独保留。
        InputTokenBreakdown breakdown = effectiveEstimate.breakdown()
                .withOtherTokens(Math.max(0, estimationDelta));
        return new ModelInvocationUsage(
                invocationId,
                modelCallIndex,
                source,
                purpose,
                identity.vendor(),
                identity.model(),
                inputTokens,
                outputTokens,
                cachedInputTokens,
                inputTokens + outputTokens,
                durationMillis,
                UsageStatus.COMPLETE,
                effectiveEstimate.counterId(),
                estimatedInput,
                estimationDelta,
                breakdown,
                effectiveEstimate.toolUsages()
        );
    }
}
