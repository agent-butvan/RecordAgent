package butvan.agent.agents.agent;

import java.util.List;

/** 用户可见内容与发送给模型的上下文分离，支持带资料引用的命令。 */
public record AgentUserCall(String sessionId, String content, String context, List<String> ragContexts) {
    public AgentUserCall(String sessionId, String content, String context) {
        this(sessionId, content, context, List.of());
    }

    public AgentUserCall(String sessionId, String context) {
        this(sessionId, context, context, List.of());
    }

    public AgentUserCall {
        ragContexts = ragContexts == null ? List.of() : List.copyOf(ragContexts);
    }
}
