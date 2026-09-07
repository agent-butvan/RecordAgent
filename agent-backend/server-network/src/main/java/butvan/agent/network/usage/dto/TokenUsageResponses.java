package butvan.agent.network.usage.dto;

import butvan.agent.agents.usage.UsageStatus;

import java.time.LocalDate;
import java.util.List;

/** Token 用量统计 HTTP 响应。 */
public final class TokenUsageResponses {

    private TokenUsageResponses() {
    }

    /** 全局或单会话用量总览。日期区间首尾均为用户输入的自然日。 */
    public record OverviewResponse(
            LocalDate from,
            LocalDate to,
            String sessionId,
            TotalsResponse totals,
            InputBreakdownResponse breakdown,
            List<ToolResponse> byTool,
            List<PurposeResponse> byPurpose,
            List<ModelResponse> byModel,
            List<DailyResponse> daily
    ) {
    }

    /** 本地估算的输入构成，Other 使用 Provider Actual 与分类估算的非负差值。 */
    public record InputBreakdownResponse(
            long estimatedInputTokens,
            long systemPromptTokens,
            long historyTokens,
            long currentUserTokens,
            long toolSchemaTokens,
            long toolResultTokens,
            long ragContextTokens,
            long otherTokens
    ) {
    }

    /** 按工具名聚合的输入占用。 */
    public record ToolResponse(String toolName, long schemaTokens, long resultTokens) {
    }

    /** 当前范围的核心合计。 */
    public record TotalsResponse(
            long inputTokens,
            long outputTokens,
            long cachedInputTokens,
            long totalTokens,
            long durationMillis,
            int turnCount,
            int trackedTurnCount,
            int modelCallCount,
            int reportedCallCount,
            UsageStatus status
    ) {
    }

    /** 按业务用途聚合。 */
    public record PurposeResponse(
            String purpose,
            long inputTokens,
            long outputTokens,
            long totalTokens,
            int modelCallCount,
            int reportedCallCount
    ) {
    }

    /** 按供应商与模型聚合。 */
    public record ModelResponse(
            String vendor,
            String model,
            long inputTokens,
            long outputTokens,
            long totalTokens,
            int modelCallCount,
            int reportedCallCount
    ) {
    }

    /** 按应用所在时区的自然日聚合，用于趋势展示。 */
    public record DailyResponse(
            LocalDate date,
            long inputTokens,
            long outputTokens,
            long totalTokens,
            int modelCallCount
    ) {
    }
}
