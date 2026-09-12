package butvan.agent.network.insight.dto;

import butvan.agent.network.insight.model.DailyInsightModels.DailyInsight;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

/** 每日洞察 HTTP 响应及领域映射。 */
public final class DailyInsightDtos {
    private DailyInsightDtos() {
    }

    public record DailyInsightResponse(
            LocalDate date,
            TodoSummaryResponse todos,
            int scheduleCount,
            RecordSummaryResponse records,
            FinanceSummaryResponse finance,
            StudySummaryResponse study) {
    }

    public record TodoSummaryResponse(int total, int completed, int pending) {
    }

    public record RecordSummaryResponse(int createdCount) {
    }

    public record FinanceSummaryResponse(int expenseCount, BigDecimal expenseTotal,
                                         Map<String, BigDecimal> expenseCategories) {
    }

    public record StudySummaryResponse(long durationSeconds, int sessionCount) {
    }

    public static DailyInsightResponse from(DailyInsight insight) {
        return new DailyInsightResponse(insight.date(),
                new TodoSummaryResponse(insight.todos().total(), insight.todos().completed(), insight.todos().pending()),
                insight.scheduleCount(),
                new RecordSummaryResponse(insight.records().createdCount()),
                new FinanceSummaryResponse(insight.finance().expenseCount(), insight.finance().expenseTotal(),
                        insight.finance().expenseCategories()),
                new StudySummaryResponse(insight.study().durationSeconds(), insight.study().sessionCount()));
    }
}
