package butvan.agent.network.chat.dto;

/** 取消接管结果；终态仍以 SSE cancelled/done 事件为准。 */
public record AgentRunCancelResponse(String runId, boolean accepted, String status) {}
