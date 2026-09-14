package butvan.agent.agents.context;

import java.time.Instant;

/** 画像辅助维护当前状态。 */
public record ProfileMaintenanceSnapshot(
        boolean enabled,
        String currentRevision,
        Instant lastCheckedAt,
        String lastResult,
        ProfileProposal pendingProposal
) {

    public ProfileMaintenanceSnapshot {
        currentRevision = currentRevision == null ? "" : currentRevision;
        lastResult = lastResult == null ? "never_checked" : lastResult;
    }
}
