package butvan.agent.network.automation.service;

import butvan.agent.network.automation.model.TaskSpec;
import butvan.agent.network.daily.service.DailyEventService;
import butvan.agent.network.daily.service.ExpenseAnalyticsService;
import butvan.agent.network.daily.model.DailyEventModels.TodoDetails;
import butvan.agent.network.study.service.StudyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.time.*;
import java.util.*;
import java.math.BigDecimal;

/** 通过领域公开 Service 生成固定模板日报，每个栏目独立降级，不调用模型。 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TaskReportBuilder {
    private final DailyEventService daily;
    private final ExpenseAnalyticsService expenses;
    private final StudyService studies;
    public record Report(String text, boolean partial) {}

    /** 读取当日已记录数据，保留真实生成时刻和统计范围。 */
    public Report build(String owner, TaskSpec s, Instant planned, Instant now) {
        if (!"DAILY_REPORT".equals(s.kind())) return new Report(s.content(), false);
        ZoneId zone = ZoneId.of(s.timezone());
        LocalDate date = planned.atZone(zone).toLocalDate();
        StringBuilder text = new StringBuilder("每日日报 · " + date + "\n截至 " + now.atZone(zone)
                + " 的当日已记录数据（非全天最终结算）\n");
        int ok = 0, failed = 0;
        if (s.expense()) {
            try {
                // 既有跨域投影已合并旧花销与财务支出，按币种分别统计。
                var entries = expenses.reportExpenses(owner, date);
                Map<String, BigDecimal> totals = new TreeMap<>();
                for (var e : entries) {
                    if (e.time() == null || !date.atTime(e.time()).atZone(zone).toInstant().isAfter(now))
                        totals.merge(e.currency(), e.amount(), BigDecimal::add);
                }
                text.append("\n支出：").append(totals.isEmpty() ? "无记录" : totals).append("\n");
                ok++;
            } catch (RuntimeException e) { log.warn("任务日报支出栏目读取失败：{}", e.getClass().getSimpleName()); text.append("\n支出：数据暂不可用\n"); failed++; }
        }
        if (s.todo()) {
            try {
                var todos = daily.getDay(owner, date).events().stream().filter(e -> e.details() instanceof TodoDetails).toList();
                long done = todos.stream().filter(e -> ((TodoDetails) e.details()).completed()).count();
                text.append("\n当日应办：").append(todos.size()).append(" 项，已完成 ").append(done).append(" 项\n");
                todos.stream().filter(e -> !((TodoDetails)e.details()).completed()).limit(100)
                        .forEach(e -> text.append("待办：").append(e.title()).append("\n"));
                if (todos.size() > 100) text.append("列表仅显示前 100 项，请在日历查看全部。\n");
                ok++;
            } catch (RuntimeException e) { log.warn("任务日报待办栏目读取失败：{}", e.getClass().getSimpleName()); text.append("\n待办：数据暂不可用\n"); failed++; }
        }
        if (s.study()) {
            try {
                var stat = studies.getStatistics(owner, date, date, zone);
                text.append("\n学习：").append(stat.sessionCount()).append(" 条记录，共 ").append(stat.totalDurationSeconds() / 60).append(" 分钟\n");
                ok++;
            } catch (RuntimeException e) { log.warn("任务日报学习栏目读取失败：{}", e.getClass().getSimpleName()); text.append("\n学习：数据暂不可用\n"); failed++; }
        }
        if (ok == 0) throw new IllegalStateException("日报所有栏目读取失败，请稍后重试");
        return new Report(text.toString(), failed > 0);
    }
}
