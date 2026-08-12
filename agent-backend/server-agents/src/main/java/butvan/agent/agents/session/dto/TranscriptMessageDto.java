package butvan.agent.agents.session.dto;

import java.time.Instant;

/** 用户界面能够稳定展示的一条完整消息。 */
public record TranscriptMessageDto(
        String id,
        String turnId,
        MessageRole role,
        String content,
        Instant createdAt,
        MessageStatus status
) {
    /** 消息角色。工具详情后续可扩展为单独事件，不和普通消息混用。 */
    public enum MessageRole {
        USER,
        ASSISTANT
    }

    /** assistant 消息是否完整、失败或因客户端断开被取消。 */
    public enum MessageStatus {
        COMPLETED,
        FAILED,
        CANCELLED
    }
}