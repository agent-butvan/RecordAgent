package butvan.agent.agents.usage;

import io.agentscope.core.event.AgentEvent;
import io.agentscope.core.event.ModelCallEndEvent;
import io.agentscope.core.event.ModelCallStartEvent;
import io.agentscope.core.model.ChatUsage;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 聚合同一聊天轮次内的全部模型调用。
 *
 * <p>采集器直接消费 AgentScope 原始事件，使用 source + replyId 幂等去重；
 * 因此工具循环、权限恢复和子 Agent 调用都能累计到同一个 turnId。</p>
 */
public final class TurnUsageAccumulator {

    private static final String MAIN_SOURCE = "main";

    private final Map<String, MutableInvocation> invocations = new LinkedHashMap<>();

    /** 记录 Middleware 在真正调用模型前看到的最终逻辑输入。 */
    public synchronized void recordInput(String invocationId, ModelInputEstimate estimate) {
        if (invocationId == null || invocationId.isBlank() || estimate == null) return;
        invocations.computeIfAbsent(invocationId, ignored ->
                new MutableInvocation(invocationId, MAIN_SOURCE, UsagePurpose.CHAT, null))
                .estimate(estimate);
    }

    /** 记录与 Token 统计有关的模型调用事件；其他事件会被忽略。 */
    public synchronized void record(
            AgentEvent event,
            ModelIdentity modelIdentity,
            UsagePurpose purpose
    ) {
        if (event instanceof ModelCallStartEvent startEvent) {
            recordStart(startEvent, modelIdentity, purpose);
        } else if (event instanceof ModelCallEndEvent endEvent) {
            recordEnd(endEvent, modelIdentity, purpose);
        }
    }

    /** 返回不可变快照；调用后仍可继续累计权限恢复产生的新调用。 */
    public synchronized TurnTokenUsage snapshot() {
        int[] callIndex = {0};
        List<ModelInvocationUsage> calls = invocations.values().stream()
                .map(invocation -> invocation.snapshot(++callIndex[0]))
                .toList();
        long inputTokens = calls.stream().map(ModelInvocationUsage::inputTokens)
                .filter(java.util.Objects::nonNull).mapToLong(Long::longValue).sum();
        long outputTokens = calls.stream().map(ModelInvocationUsage::outputTokens)
                .filter(java.util.Objects::nonNull).mapToLong(Long::longValue).sum();
        long cachedInputTokens = calls.stream().map(ModelInvocationUsage::cachedInputTokens)
                .filter(java.util.Objects::nonNull).mapToLong(Long::longValue).sum();
        int reportedCallCount = (int) calls.stream()
                .filter(call -> call.status() == UsageStatus.COMPLETE)
                .count();
        UsageStatus status = aggregateStatus(calls.size(), reportedCallCount);
        InputTokenBreakdown breakdown = calls.stream()
                .map(ModelInvocationUsage::breakdown)
                .reduce(InputTokenBreakdown.empty(), InputTokenBreakdown::plus);
        long estimatedInputTokens = calls.stream()
                .mapToLong(ModelInvocationUsage::estimatedInputTokens).sum();
        long durationMillis = calls.stream().map(ModelInvocationUsage::durationMillis)
                .filter(java.util.Objects::nonNull).mapToLong(Long::longValue).sum();
        Long estimationDeltaTokens = calls.stream().allMatch(call -> call.estimationDeltaTokens() != null)
                ? calls.stream().mapToLong(ModelInvocationUsage::estimationDeltaTokens).sum()
                : null;
        Map<String, ToolTokenUsage> tools = calls.stream()
                .flatMap(call -> call.toolUsages().stream())
                .collect(Collectors.toMap(
                        ToolTokenUsage::toolName,
                        value -> value,
                        ToolTokenUsage::plus,
                        LinkedHashMap::new));
        return new TurnTokenUsage(
                inputTokens,
                outputTokens,
                cachedInputTokens,
                inputTokens + outputTokens,
                calls.size(),
                reportedCallCount,
                status,
                calls,
                estimatedInputTokens,
                estimationDeltaTokens,
                breakdown,
                List.copyOf(tools.values()),
                durationMillis
        );
    }

    private void recordStart(
            ModelCallStartEvent event,
            ModelIdentity modelIdentity,
            UsagePurpose purpose
    ) {
        String source = normalizeSource(event.getSource());
        String invocationId = normalizeInvocationId(event.getReplyId(), event.getId());
        invocations.computeIfAbsent(invocationId, ignored ->
                new MutableInvocation(invocationId, source, effectivePurpose(purpose), modelIdentity))
                .identify(source, effectivePurpose(purpose), modelIdentity);
    }

    private void recordEnd(
            ModelCallEndEvent event,
            ModelIdentity modelIdentity,
            UsagePurpose purpose
    ) {
        String source = normalizeSource(event.getSource());
        String invocationId = normalizeInvocationId(event.getReplyId(), event.getId());
        MutableInvocation invocation = invocations.computeIfAbsent(invocationId, ignored ->
                new MutableInvocation(invocationId, source, effectivePurpose(purpose), modelIdentity));
        invocation.identify(source, effectivePurpose(purpose), modelIdentity);
        invocation.complete(event.getUsage());
    }

    private static UsageStatus aggregateStatus(int callCount, int reportedCallCount) {
        if (callCount == 0 || reportedCallCount == 0) return UsageStatus.UNAVAILABLE;
        return reportedCallCount == callCount ? UsageStatus.COMPLETE : UsageStatus.PARTIAL;
    }

    private static String normalizeSource(String source) {
        return source == null || source.isBlank() ? MAIN_SOURCE : source.strip();
    }

    private static String normalizeInvocationId(String replyId, String eventId) {
        return replyId == null || replyId.isBlank() ? eventId : replyId.strip();
    }

    private static UsagePurpose effectivePurpose(UsagePurpose purpose) {
        return purpose == null ? UsagePurpose.CHAT : purpose;
    }

    /** 单次调用的可变累积状态，只对外暴露不可变快照。 */
    private static final class MutableInvocation {
        private final String invocationId;
        private String source;
        private UsagePurpose purpose;
        private ModelIdentity modelIdentity;
        private ChatUsage usage;
        private ModelInputEstimate inputEstimate;

        private MutableInvocation(
                String invocationId,
                String source,
                UsagePurpose purpose,
                ModelIdentity modelIdentity
        ) {
            this.invocationId = invocationId;
            this.source = source;
            this.purpose = purpose;
            this.modelIdentity = modelIdentity == null
                    ? new ModelIdentity(null, null)
                    : modelIdentity;
        }

        private void identify(String reportedSource, UsagePurpose reportedPurpose, ModelIdentity identity) {
            if (reportedSource != null && !reportedSource.isBlank()) source = reportedSource;
            if (reportedPurpose != null) purpose = reportedPurpose;
            if (identity != null) modelIdentity = identity;
        }

        private void estimate(ModelInputEstimate estimate) {
            if (inputEstimate == null) inputEstimate = estimate;
        }

        private void complete(ChatUsage reportedUsage) {
            // 重复结束事件不能重复计数；但允许后续有效数据补全先前的空 usage。
            if (usage == null && reportedUsage != null) {
                usage = reportedUsage;
            }
        }

        private ModelInvocationUsage snapshot(int callIndex) {
            return ModelInvocationUsage.fromProvider(
                    invocationId, callIndex, source, purpose, modelIdentity, usage, inputEstimate
            );
        }
    }
}
