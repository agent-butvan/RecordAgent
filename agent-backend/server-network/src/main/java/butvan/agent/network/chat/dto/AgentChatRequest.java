package butvan.agent.network.chat.dto;

import java.util.List;

/** 桌面端发起聊天时可携带的用户可见内容、问题上下文与稳定资料引用。 */
public record AgentChatRequest(
        String runId,
        String sessionId,
        String content,
        String context,
        List<String> recordReferenceIds,
        AgentAnalysisContextRequest analysisContext) {

    /** 保留内部测试与非可取消调用方的兼容构造方式。 */
    public AgentChatRequest(
            String sessionId,
            String content,
            String context,
            List<String> recordReferenceIds,
            AgentAnalysisContextRequest analysisContext
    ) {
        this(null, sessionId, content, context, recordReferenceIds, analysisContext);
    }
}
