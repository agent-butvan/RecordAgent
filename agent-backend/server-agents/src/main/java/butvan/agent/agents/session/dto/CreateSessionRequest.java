package butvan.agent.agents.session.dto;

/** 创建一个空会话的请求。 */
public record CreateSessionRequest(
        SessionKind kind,
        String title
) {}