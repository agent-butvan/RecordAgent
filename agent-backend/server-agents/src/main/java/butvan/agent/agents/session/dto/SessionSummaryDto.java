package butvan.agent.agents.session.dto;

import java.time.Instant;

/** 侧边栏使用的会话摘要，不包含完整消息。 */
public record SessionSummaryDto(
        String id,
        SessionKind kind,
        String projectId,
        String title,
        String lastMessagePreview,
        Instant createdAt,
        Instant updatedAt,
        SessionStatus status
) {
}
