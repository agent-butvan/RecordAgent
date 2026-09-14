package butvan.agent.network.context.dto;

import butvan.agent.agents.context.PersonalContextProfile;
import butvan.agent.agents.context.ContextRequest;
import butvan.agent.agents.context.PersonalContextService;
import butvan.agent.agents.context.ProfileChange;
import butvan.agent.agents.context.ProfileMaintenanceSnapshot;
import butvan.agent.agents.context.ProfileProposal;

import java.time.Instant;
import java.util.List;

/** 个人上下文 HTTP 输入输出对象。 */
public final class PersonalContextDtos {

    private PersonalContextDtos() {
    }

    /** 设置页所需的个人上下文状态与硬预算。 */
    public record Response(
            boolean enabled,
            boolean maintenanceEnabled,
            String profile,
            String source,
            String revision,
            int estimatedTokens,
            int profileTokenBudget,
            int memoryTokenBudget,
            int totalTokenBudget,
            int maxProfileChars
    ) {
    }

    /** 更新显式个人画像。 */
    public record UpdateProfileRequest(String profile) {
    }

    /** 开启或暂停自动注入。 */
    public record UpdateEnabledRequest(boolean enabled) {
    }

    /** 开启或暂停画像辅助维护。 */
    public record UpdateMaintenanceRequest(boolean enabled) {
    }

    /** 确认画像提案时携带并发 revision，以及用户可选的审核后文本。 */
    public record AcceptProposalRequest(String expectedRevision, String profile) {
    }

    /** 画像辅助维护状态。 */
    public record MaintenanceResponse(
            boolean enabled,
            String currentRevision,
            Instant lastCheckedAt,
            String lastResult,
            ProposalResponse pendingProposal
    ) {
    }

    /** 待审核画像提案。 */
    public record ProposalResponse(
            String id,
            String baseRevision,
            Instant createdAt,
            String summary,
            String proposedProfile,
            List<ChangeResponse> changes
    ) {
    }

    /** 一项画像变更及其记忆依据。 */
    public record ChangeResponse(
            String operation,
            String section,
            String before,
            String after,
            String reason,
            List<String> sourceIds,
            double confidence
    ) {
    }

    /** 将领域状态映射为稳定的网络响应。 */
    public static Response from(PersonalContextProfile profile) {
        return new Response(profile.enabled(), profile.maintenanceEnabled(), profile.content(),
                profile.source(), profile.revision(),
                profile.estimatedTokens(), ContextRequest.DEFAULT_PROFILE_BUDGET,
                ContextRequest.DEFAULT_MEMORY_BUDGET,
                ContextRequest.DEFAULT_TOTAL_BUDGET,
                PersonalContextService.MAX_PROFILE_CHARS);
    }

    /** 将画像维护领域状态映射为网络 DTO。 */
    public static MaintenanceResponse from(ProfileMaintenanceSnapshot snapshot) {
        return new MaintenanceResponse(snapshot.enabled(), snapshot.currentRevision(),
                snapshot.lastCheckedAt(), snapshot.lastResult(), from(snapshot.pendingProposal()));
    }

    private static ProposalResponse from(ProfileProposal proposal) {
        if (proposal == null) return null;
        return new ProposalResponse(proposal.id(), proposal.baseRevision(), proposal.createdAt(),
                proposal.summary(), proposal.proposedProfile(),
                proposal.changes().stream().map(PersonalContextDtos::from).toList());
    }

    private static ChangeResponse from(ProfileChange change) {
        return new ChangeResponse(change.operation().name(), change.section(), change.before(),
                change.after(), change.reason(), change.sourceIds(), change.confidence());
    }
}
