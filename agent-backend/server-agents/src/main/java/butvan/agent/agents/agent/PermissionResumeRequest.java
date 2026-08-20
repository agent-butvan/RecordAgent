package butvan.agent.agents.agent;

/** 前端在本批逐条确认完成后，请求恢复 Agent。 */
public record PermissionResumeRequest(String sessionId, String approvalId) {}