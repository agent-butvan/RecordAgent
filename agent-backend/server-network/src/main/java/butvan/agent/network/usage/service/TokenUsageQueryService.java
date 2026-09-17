package butvan.agent.network.usage.service;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.agents.session.SessionCatalogService;
import butvan.agent.agents.usage.UsageStatus;
import butvan.agent.network.usage.dto.TokenUsageResponses.DailyResponse;
import butvan.agent.network.usage.dto.TokenUsageResponses.InputBreakdownResponse;
import butvan.agent.network.usage.dto.TokenUsageResponses.ModelResponse;
import butvan.agent.network.usage.dto.TokenUsageResponses.OverviewResponse;
import butvan.agent.network.usage.dto.TokenUsageResponses.PurposeResponse;
import butvan.agent.network.usage.dto.TokenUsageResponses.TotalsResponse;
import butvan.agent.network.usage.dto.TokenUsageResponses.ToolResponse;
import butvan.agent.network.usage.repository.TokenUsageRepository;
import butvan.agent.network.usage.repository.TokenUsageRepository.QueryScope;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/** Token 用量统计业务服务，统一范围语义与完整性状态。 */
@Service
@RequiredArgsConstructor
public class TokenUsageQueryService {

    private final CurrentUserProvider currentUserProvider;
    private final SessionCatalogService sessionCatalogService;
    private final TokenUsageIndexService indexService;
    private final TokenUsageRepository repository;

    /**
     * 查询闭区间自然日范围；空日期表示不限制，sessionId 为空表示全部会话及系统调用。
     */
    public OverviewResponse overview(LocalDate from, LocalDate to, String sessionId) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new IllegalArgumentException("开始日期不能晚于结束日期");
        }
        if (sessionId != null && !sessionId.isBlank()) {
            sessionCatalogService.requireActive(sessionId);
        }
        indexService.synchronize();

        ZoneId localZone = ZoneId.systemDefault();
        Instant fromInclusive = from == null ? null : from.atStartOfDay(localZone).toInstant();
        Instant toExclusive = to == null ? null : to.plusDays(1).atStartOfDay(localZone).toInstant();
        QueryScope scope = new QueryScope(
                currentUserProvider.currentUserId(), fromInclusive, toExclusive,
                sessionId == null || sessionId.isBlank() ? null : sessionId);
        var invocation = repository.summarizeInvocations(scope);
        var turns = repository.summarizeTurns(scope);
        var breakdown = repository.summarizeBreakdown(scope);
        UsageStatus status = aggregateStatus(invocation.modelCallCount(), invocation.reportedCallCount());
        return new OverviewResponse(
                from, to, scope.sessionId(),
                new TotalsResponse(
                        invocation.inputTokens(), invocation.outputTokens(), invocation.cachedInputTokens(),
                        invocation.totalTokens(), invocation.durationMillis(), turns.turnCount(),
                        turns.trackedTurnCount(), invocation.modelCallCount(),
                        invocation.reportedCallCount(), status),
                new InputBreakdownResponse(
                        breakdown.estimatedInputTokens(), breakdown.systemPromptTokens(),
                        breakdown.historyTokens(), breakdown.currentUserTokens(),
                        breakdown.toolSchemaTokens(), breakdown.toolResultTokens(),
                        breakdown.profileContextTokens(), breakdown.memoryRecallTokens(),
                        breakdown.ragContextTokens(), breakdown.otherTokens()),
                repository.summarizeByTool(scope).stream()
                        .map(value -> new ToolResponse(
                                value.toolName(), value.schemaTokens(), value.resultTokens()))
                        .toList(),
                repository.summarizeByPurpose(scope).stream()
                        .map(value -> new PurposeResponse(
                                value.purpose(), value.inputTokens(), value.outputTokens(), value.totalTokens(),
                                value.modelCallCount(), value.reportedCallCount()))
                        .toList(),
                repository.summarizeByModel(scope).stream()
                        .map(value -> new ModelResponse(
                                value.vendor(), value.model(), value.inputTokens(), value.outputTokens(),
                                value.totalTokens(), value.modelCallCount(), value.reportedCallCount()))
                        .toList(),
                repository.summarizeByDay(scope).stream()
                        .map(value -> new DailyResponse(
                                LocalDate.parse(value.date()), value.inputTokens(), value.outputTokens(),
                                value.totalTokens(), value.modelCallCount()))
                        .toList()
        );
    }

    private UsageStatus aggregateStatus(int modelCallCount, int reportedCallCount) {
        if (modelCallCount == 0 || reportedCallCount == 0) return UsageStatus.UNAVAILABLE;
        return modelCallCount == reportedCallCount ? UsageStatus.COMPLETE : UsageStatus.PARTIAL;
    }
}
