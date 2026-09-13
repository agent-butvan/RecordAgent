package butvan.agent.agents.session.dto;

/** 创建一个空会话的请求。 */
public record CreateSessionRequest(
        SessionKind kind,
        String title,
        String projectId
) {
    /** 兼容普通会话的既有调用。 */
    public CreateSessionRequest(SessionKind kind, String title) {
        this(kind, title, null);
    }
}
