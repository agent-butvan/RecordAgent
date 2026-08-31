package butvan.agent.agents.agent.permission;

/**
 * 前端对单个待确认工具提交决定
 */
public record PermissionDecisionRequest(
        String sessionId,
        String approvalId,
        String toolCallId,
        boolean approved,
        boolean rememberForSession
) {
}
