package butvan.agent.network.usage.model;

import java.time.Instant;

/** Token 用量 SQLite 读模型写入对象。 */
public final class TokenUsageIndexModels {

    private TokenUsageIndexModels() {
    }

    /** 一条 assistant 消息对应的轮次汇总。 */
    public record TurnEntry(
            String messageId, String ownerId, String sessionId, String turnId, Instant occurredAt,
            long inputTokens, long outputTokens, long cachedInputTokens, long totalTokens,
            int modelCallCount, int reportedCallCount, String usageStatus
    ) {
    }

    /** 一次聊天或系统模型调用。 */
    public record InvocationEntry(
            String id, String ownerId, String sessionId, String turnId, String messageId,
            String usageKind, String purpose, Instant occurredAt, String invocationId,
            String source, String vendor, String model, Long inputTokens, Long outputTokens,
            Long cachedInputTokens, Long totalTokens, Long durationMillis, String usageStatus
    ) {
    }

    /** 指定筛选范围内的调用与 Token 合计。 */
    public record InvocationAggregate(
            long inputTokens, long outputTokens, long cachedInputTokens, long totalTokens,
            long durationMillis, int modelCallCount, int reportedCallCount
    ) {
    }

    /** 指定筛选范围内的聊天轮次数。 */
    public record TurnAggregate(int turnCount, int trackedTurnCount) {
    }

    /** 按用途聚合的调用数据。 */
    public record PurposeAggregate(
            String purpose, long inputTokens, long outputTokens, long totalTokens,
            int modelCallCount, int reportedCallCount
    ) {
    }

    /** 按供应商与模型聚合的调用数据。 */
    public record ModelAggregate(
            String vendor, String model, long inputTokens, long outputTokens, long totalTokens,
            int modelCallCount, int reportedCallCount
    ) {
    }

    /** 按本地自然日聚合的调用数据。 */
    public record DailyAggregate(
            String date, long inputTokens, long outputTokens, long totalTokens, int modelCallCount
    ) {
    }
}
