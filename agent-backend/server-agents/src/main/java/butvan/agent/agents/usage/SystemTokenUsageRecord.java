package butvan.agent.agents.usage;

import java.time.Instant;

/** 不属于用户聊天轮次的模型调用用量记录。 */
public record SystemTokenUsageRecord(
        String id,
        String sessionId,
        UsagePurpose purpose,
        Instant createdAt,
        ModelInvocationUsage usage
) {
}
