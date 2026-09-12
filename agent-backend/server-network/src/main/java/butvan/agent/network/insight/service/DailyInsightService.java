package butvan.agent.network.insight.service;

import butvan.agent.network.daily.model.DailyEventModels.DailyEvent;
import butvan.agent.network.daily.model.DailyEventModels.TodoDetails;
import butvan.agent.network.daily.service.DailyEventService;
import butvan.agent.network.daily.service.ExpenseAnalyticsService;
import butvan.agent.network.insight.model.DailyInsightModels.DailyInsight;
import butvan.agent.network.insight.model.DailyInsightModels.FinanceSummary;
import butvan.agent.network.insight.model.DailyInsightModels.RecordSummary;
import butvan.agent.network.insight.model.DailyInsightModels.StudySummary;
import butvan.agent.network.insight.model.DailyInsightModels.TodoSummary;
import butvan.agent.network.record.service.RecordService;
import butvan.agent.network.study.service.StudyService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/**
 * 在一个只读入口内组合日历、资料、财务与学习的既有统计口径。
 *
 * <p>调用方只需提供用户、自然日和时区，不需要了解各领域的查询细节。</p>
 */
@Service
@RequiredArgsConstructor
public class DailyInsightService {
    private final DailyEventService dailyEventService;
    private final RecordService recordService;
    private final ExpenseAnalyticsService expenseAnalyticsService;
    private final StudyService studyService;

    /** 返回指定自然日的活动汇总，不调用模型且不写入业务数据。 */
    @Transactional(readOnly = true)
    public DailyInsight getDailyInsight(String ownerId, LocalDate date, ZoneId timezone) {
        if (ownerId == null || ownerId.isBlank()) throw new IllegalArgumentException("用户不能为空");
        if (date == null || timezone == null) throw new IllegalArgumentException("日期与时区不能为空");

        List<DailyEvent> events = dailyEventService.getDay(ownerId, date).events();
        List<TodoDetails> todos = events.stream()
                .filter(event -> "todo".equals(event.eventType()))
                .map(DailyEvent::details)
                .filter(TodoDetails.class::isInstance)
                .map(TodoDetails.class::cast)
                .toList();
        int completedTodos = (int) todos.stream().filter(TodoDetails::completed).count();
        int scheduleCount = (int) events.stream().filter(event -> "schedule".equals(event.eventType())).count();
        int expenseCount = (int) events.stream().filter(event -> "expense".equals(event.eventType())).count();

        int recordCount = recordService.summarizeDays(ownerId, date, date).stream()
                .findFirst().map(summary -> summary.count()).orElse(0);
        var expenseDay = expenseAnalyticsService.analyze(ownerId, date, date).days().getFirst();
        var study = studyService.getStatistics(ownerId, date, date, timezone);

        return new DailyInsight(date,
                new TodoSummary(todos.size(), completedTodos, todos.size() - completedTodos),
                scheduleCount,
                new RecordSummary(recordCount),
                new FinanceSummary(expenseCount, expenseDay.total(), expenseDay.categories()),
                new StudySummary(study.totalDurationSeconds(), study.sessionCount()));
    }
}
