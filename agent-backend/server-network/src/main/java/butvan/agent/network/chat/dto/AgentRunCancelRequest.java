package butvan.agent.network.chat.dto;

/** 用户显式停止当前 Agent 回复的请求。 */
public record AgentRunCancelRequest(String sessionId) {}
