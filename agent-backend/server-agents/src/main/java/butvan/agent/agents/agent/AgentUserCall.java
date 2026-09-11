package butvan.agent.agents.agent;

/** 用户可见内容与发送给模型的上下文分离，支持带资料引用的命令。 */
public record AgentUserCall(String sessionId, String content, String context) {
    public AgentUserCall(String sessionId, String context) {
        this(sessionId, context, context);
    }
}
