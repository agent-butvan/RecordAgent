package butvan.agent.agents.usage;

import io.agentscope.core.event.AgentEvent;
import io.agentscope.core.event.ModelCallEndEvent;
import io.agentscope.core.event.ModelCallStartEvent;
import io.agentscope.core.model.ChatUsage;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 聚合同一聊天轮次内的全部模型调用。
 *
 * <p>采集器直接消费 AgentScope 原始事件，使用 source + replyId 幂等去重；
 * 因此工具循环、权限恢复和子 Agent 调用都能累计到同一个 turnId。</p>
 */
public final class TurnUsageAccumulator {

    private static final String MAIN_SOURCE = "main";

    private final Map<String, MutableInvocation> invocations = new LinkedHashMap<>();

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
        List<ModelInvocationUsage> calls = invocations.values().stream()
                .map(MutableInvocation::snapshot)
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
        return new TurnTokenUsage(
                inputTokens,
                outputTokens,
                cachedInputTokens,
                inputTokens + outputTokens,
                calls.size(),
                reportedCallCount,
                status,
                calls
        );
    }

    private void recordStart(
            ModelCallStartEvent event,
            ModelIdentity modelIdentity,
            UsagePurpose purpose
    ) {
        String source = normalizeSource(event.getSource());
        String invocationId = normalizeInvocationId(event.getReplyId(), event.getId());
        invocations.computeIfAbsent(key(source, invocationId), ignored ->
                new MutableInvocation(invocationId, source, effectivePurpose(purpose), modelIdentity));
    }

    private void recordEnd(
            ModelCallEndEvent event,
            ModelIdentity modelIdentity,
            UsagePurpose purpose
    ) {
        String source = normalizeSource(event.getSource());
        String invocationId = normalizeInvocationId(event.getReplyId(), event.getId());
        MutableInvocation invocation = invocations.computeIfAbsent(key(source, invocationId), ignored ->
                new MutableInvocation(invocationId, source, effectivePurpose(purpose), modelIdentity));
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

    private static String key(String source, String invocationId) {
        return source + "\u0000" + invocationId;
    }

    /** 单次调用的可变累积状态，只对外暴露不可变快照。 */
    private static final class MutableInvocation {
        private final String invocationId;
        private final String source;
        private final UsagePurpose purpose;
        private final ModelIdentity modelIdentity;
        private ChatUsage usage;

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

        private void complete(ChatUsage reportedUsage) {
            // 重复结束事件不能重复计数；但允许后续有效数据补全先前的空 usage。
            if (usage == null && reportedUsage != null) {
                usage = reportedUsage;
            }
        }

        private ModelInvocationUsage snapshot() {
            if (usage == null) {
                return new ModelInvocationUsage(
                        invocationId,
                        source,
                        purpose,
                        modelIdentity.vendor(),
                        modelIdentity.model(),
                        null,
                        null,
                        null,
                        null,
                        null,
                        UsageStatus.UNAVAILABLE
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
                    modelIdentity.vendor(),
                    modelIdentity.model(),
                    inputTokens,
                    outputTokens,
                    cachedInputTokens,
                    inputTokens + outputTokens,
                    durationMillis,
                    UsageStatus.COMPLETE
            );
        }
    }
}
