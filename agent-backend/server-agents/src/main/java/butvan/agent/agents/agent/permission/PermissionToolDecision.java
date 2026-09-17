package butvan.agent.agents.agent.permission;

/** 单个工具调用的审核决定。 */
public record PermissionToolDecision(
        String toolCallId,
        boolean approved,
        boolean rememberForSession
) {}
