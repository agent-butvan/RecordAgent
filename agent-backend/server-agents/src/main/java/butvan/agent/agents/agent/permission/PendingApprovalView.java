package butvan.agent.agents.agent.permission;

import java.time.Instant;
import java.util.List;

/** 前端恢复待审批界面所需的权威快照。 */
public record PendingApprovalView(
        String sessionId,
        String approvalId,
        String runId,
        String turnId,
        String partialContent,
        Instant startedAt,
        boolean readyToResume,
        List<PermissionToolDto> tools
) {
    public static PendingApprovalView from(PendingApproval approval) {
        return new PendingApprovalView(
                approval.run().sessionId(),
                approval.approvalId(),
                approval.runId(),
                approval.run().turnId(),
                approval.run().contentAsString(),
                approval.run().startedAt(),
                approval.allDecided(),
                approval.pendingTools()
        );
    }
}
