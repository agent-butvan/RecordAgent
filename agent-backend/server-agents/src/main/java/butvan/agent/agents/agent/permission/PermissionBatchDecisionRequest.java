package butvan.agent.agents.agent.permission;

import java.util.List;

/** 前端对同一审批批次中全部待确认工具提交的决定。 */
public record PermissionBatchDecisionRequest(
        String sessionId,
        String approvalId,
        List<PermissionToolDecision> decisions
) {
    public PermissionBatchDecisionRequest {
        decisions = decisions == null ? List.of() : List.copyOf(decisions);
    }
}
