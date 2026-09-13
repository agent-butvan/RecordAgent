package butvan.agent.network.usage.service;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.agents.session.SessionCatalogService;
import butvan.agent.agents.session.TranscriptService;
import butvan.agent.agents.session.dto.TranscriptMessageDto;
import butvan.agent.agents.usage.ModelInvocationUsage;
import butvan.agent.agents.usage.SystemTokenUsageRecord;
import butvan.agent.agents.usage.SystemUsageLedger;
import butvan.agent.agents.usage.TurnTokenUsage;
import butvan.agent.agents.usage.UsageStatus;
import butvan.agent.network.usage.model.TokenUsageIndexModels.InvocationEntry;
import butvan.agent.network.usage.model.TokenUsageIndexModels.ToolEntry;
import butvan.agent.network.usage.model.TokenUsageIndexModels.TurnEntry;
import butvan.agent.network.usage.repository.TokenUsageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/** 从权威 JSON 文件重建当前用户的 Token 用量 SQLite 读模型。 */
@Service
@RequiredArgsConstructor
public class TokenUsageIndexService {

    private final CurrentUserProvider currentUserProvider;
    private final SessionCatalogService sessionCatalogService;
    private final TranscriptService transcriptService;
    private final SystemUsageLedger systemUsageLedger;
    private final TokenUsageRepository repository;

    /**
     * 在单个事务中完整替换读模型。
     *
     * <p>统计查询频率远低于聊天写入频率；按需重建可天然兼容旧 transcript、
     * 会话删除和异常恢复，并避免让 Agent 编排模块反向依赖 SQLite。</p>
     */
    @Transactional
    public void synchronize() {
        String ownerId = currentUserProvider.currentUserId();
        List<TurnEntry> turns = new ArrayList<>();
        List<InvocationEntry> invocations = new ArrayList<>();
        List<ToolEntry> tools = new ArrayList<>();

        sessionCatalogService.listActive().forEach(session ->
                transcriptService.list(session.id()).stream()
                        .filter(message -> message.role() == TranscriptMessageDto.MessageRole.ASSISTANT)
                        .forEach(message -> appendChat(
                                ownerId, session.id(), message, turns, invocations, tools)));
        systemUsageLedger.list().forEach(record -> invocations.add(toSystemInvocation(ownerId, record)));
        repository.replace(ownerId, turns, invocations, tools);
    }

    private void appendChat(
            String ownerId,
            String sessionId,
            TranscriptMessageDto message,
            List<TurnEntry> turns,
            List<InvocationEntry> invocations,
            List<ToolEntry> tools
    ) {
        TurnTokenUsage usage = message.usage();
        turns.add(new TurnEntry(
                message.id(), ownerId, sessionId, message.turnId(), message.createdAt(),
                usage == null ? 0 : usage.inputTokens(),
                usage == null ? 0 : usage.outputTokens(),
                usage == null ? 0 : usage.cachedInputTokens(),
                usage == null ? 0 : usage.totalTokens(),
                usage == null ? 0 : usage.modelCallCount(),
                usage == null ? 0 : usage.reportedCallCount(),
                usage == null ? UsageStatus.UNAVAILABLE.name() : usage.status().name()
        ));
        if (usage == null) return;
        for (int index = 0; index < usage.calls().size(); index++) {
            String rowId = "chat:" + message.id() + ":" + index;
            ModelInvocationUsage call = usage.calls().get(index);
            invocations.add(toChatInvocation(rowId, ownerId, sessionId, message, call));
            call.toolUsages().forEach(tool -> tools.add(new ToolEntry(
                    rowId, tool.toolName(), tool.schemaTokens(), tool.resultTokens())));
        }
    }

    private InvocationEntry toChatInvocation(
            String rowId,
            String ownerId,
            String sessionId,
            TranscriptMessageDto message,
            ModelInvocationUsage usage
    ) {
        var breakdown = usage.breakdown();
        return new InvocationEntry(
                rowId,
                ownerId, sessionId, message.turnId(), message.id(), "CHAT",
                usage.purpose().name(), message.createdAt(), usage.invocationId(), usage.source(),
                usage.vendor(), usage.model(), usage.inputTokens(), usage.outputTokens(),
                usage.cachedInputTokens(), usage.totalTokens(), usage.durationMillis(), usage.status().name(),
                usage.modelCallIndex(), usage.tokenCounterId(), usage.estimatedInputTokens(),
                usage.estimationDeltaTokens(), breakdown.systemPromptTokens(), breakdown.historyTokens(),
                breakdown.currentUserTokens(), breakdown.toolSchemaTokens(), breakdown.toolResultTokens(),
                breakdown.profileContextTokens(), breakdown.memoryRecallTokens(),
                breakdown.ragContextTokens(), breakdown.otherTokens()
        );
    }

    private InvocationEntry toSystemInvocation(String ownerId, SystemTokenUsageRecord record) {
        ModelInvocationUsage usage = record.usage();
        var breakdown = usage.breakdown();
        return new InvocationEntry(
                "system:" + record.id(), ownerId, record.sessionId(), null, null, "SYSTEM",
                record.purpose().name(), record.createdAt(), usage.invocationId(), usage.source(),
                usage.vendor(), usage.model(), usage.inputTokens(), usage.outputTokens(),
                usage.cachedInputTokens(), usage.totalTokens(), usage.durationMillis(), usage.status().name(),
                usage.modelCallIndex(), usage.tokenCounterId(), usage.estimatedInputTokens(),
                usage.estimationDeltaTokens(), breakdown.systemPromptTokens(), breakdown.historyTokens(),
                breakdown.currentUserTokens(), breakdown.toolSchemaTokens(), breakdown.toolResultTokens(),
                breakdown.profileContextTokens(), breakdown.memoryRecallTokens(),
                breakdown.ragContextTokens(), breakdown.otherTokens()
        );
    }
}
