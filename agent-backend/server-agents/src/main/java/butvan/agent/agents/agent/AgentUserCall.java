package butvan.agent.agents.agent;

import java.util.List;

/** 用户可见内容与发送给模型的上下文分离，支持带资料引用的命令。 */
public record AgentUserCall(
        String sessionId,
        String content,
        String context,
        List<String> ragContexts,
        String runId) {

    public AgentUserCall(String sessionId, String content, String context, List<String> ragContexts) {
        this(sessionId, content, context, ragContexts, null);
    }

    public AgentUserCall(String sessionId, String content, String context) {
        this(sessionId, content, context, List.of(), null);
    }

    public AgentUserCall(String sessionId, String context) {
        this(sessionId, context, context, List.of(), null);
    }

    public AgentUserCall {
        ragContexts = ragContexts == null ? List.of() : List.copyOf(ragContexts);
    }
}
