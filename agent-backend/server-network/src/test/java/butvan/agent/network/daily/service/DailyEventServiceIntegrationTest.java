package butvan.agent.network.daily.service;

import butvan.agent.network.config.database.LocalDatabaseConfiguration;
import butvan.agent.network.daily.DailyEventModuleConfiguration;
import butvan.agent.network.daily.model.DailyEventModels.DailyEvent;
import butvan.agent.network.daily.model.DailyEventModels.ExpenseCommand;
import butvan.agent.network.daily.model.DailyEventModels.JournalCommand;
import butvan.agent.network.daily.model.DailyEventModels.JournalDetails;
import butvan.agent.network.daily.model.DailyEventModels.ScheduleCommand;
import butvan.agent.network.daily.model.DailyEventModels.ScheduleDetails;
import butvan.agent.network.daily.model.DailyEventModels.TodoCommand;
import butvan.agent.network.daily.model.DailyEventModels.TodoDetails;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 通过公开领域接口和真实临时 SQLite 验证日记录行为。 */
@SpringBootTest(classes = {LocalDatabaseConfiguration.class, DailyEventModuleConfiguration.class})
class DailyEventServiceIntegrationTest {

    private static final Path DATABASE_PATH = createDatabasePath();

    @Autowired
    private DailyEventService dailyEventService;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("butvan.database.path", DATABASE_PATH::toString);
    }

    @Test
    void userCanCreateAndRetrieveTodoForOneDay() {
        LocalDate date = LocalDate.of(2026, 9, 3);

        DailyEvent created = dailyEventService.create(
                "local-default",
                new TodoCommand(date, "整理学习笔记", "20:30", "high"));

        var day = dailyEventService.getDay("local-default", date);
        assertEquals(1, day.events().size());
        assertEquals(created.id(), day.events().getFirst().id());
        TodoDetails details = assertInstanceOf(TodoDetails.class, day.events().getFirst().details());
        assertEquals("20:30", details.time());
        assertEquals("high", details.priority());
        assertFalse(details.completed());
    }

    @Test
    void dayCanAggregateIndependentRecordTypesAndProduceRangeSummary() {
        LocalDate date = LocalDate.of(2026, 9, 4);
        dailyEventService.create("local-default",
                new ScheduleCommand(date, "项目评审", "09:30", "10:30", "线上", ZoneId.of("Asia/Shanghai")));
        dailyEventService.create("local-default",
                new ExpenseCommand(date, "餐饮", "午餐", new BigDecimal("26.80"), "12:10", "CNY"));
        dailyEventService.create("local-default",
                new JournalCommand(date, "今天的复盘", "日记录模型已经跑通。", "充实"));

        var day = dailyEventService.getDay("local-default", date);
        Set<String> types = day.events().stream().map(DailyEvent::eventType).collect(Collectors.toSet());
        assertEquals(Set.of("schedule", "expense", "journal"), types);

        var summaries = dailyEventService.getDays(
                "local-default", LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30));
        var summary = summaries.stream().filter(item -> item.date().equals(date)).findFirst().orElseThrow();
        assertEquals(3, summary.eventCount());
        assertEquals(new BigDecimal("26.80"), summary.expenseTotal());
        assertEquals(1, summary.scheduleCount());
    }

    @Test
    void todoCanBeCompletedWithVersionCheckAndDeleted() {
        LocalDate date = LocalDate.of(2026, 9, 5);
        DailyEvent created = dailyEventService.create(
                "local-default", new TodoCommand(date, "完成数据库验收", null, "medium"));

        DailyEvent completed = dailyEventService.setTodoCompleted(
                "local-default", created.id(), true, created.version());
        assertEquals(1, completed.version());
        assertTrue(assertInstanceOf(TodoDetails.class, completed.details()).completed());

        dailyEventService.delete("local-default", completed.id(), completed.version());
        assertTrue(dailyEventService.getDay("local-default", date).events().isEmpty());
    }

    @Test
    void recurringTodosShareCompletionWithinTheirConfiguredPeriod() {
        LocalDate start = LocalDate.of(2026, 9, 1);
        DailyEvent daily = dailyEventService.create(
                "recurring-user", new TodoCommand(start, "学习一个知识点", null, "medium", "daily"));
        DailyEvent weekly = dailyEventService.create(
                "recurring-user", new TodoCommand(start, "完成一次复盘", null, "high", "weekly"));
        DailyEvent monthly = dailyEventService.create(
                "recurring-user", new TodoCommand(start, "读完一本书", null, "low", "monthly"));

        LocalDate wednesday = LocalDate.of(2026, 9, 2);
        DailyEvent completedWeekly = dailyEventService.setTodoCompleted(
                "recurring-user", weekly.id(), true, weekly.version(), wednesday);
        dailyEventService.setTodoCompleted(
                "recurring-user", daily.id(), true, daily.version(), wednesday);
        dailyEventService.setTodoCompleted(
                "recurring-user", monthly.id(), true, monthly.version(), wednesday);

        var sameWeek = dailyEventService.getDay("recurring-user", LocalDate.of(2026, 9, 6));
        assertTrue(todoDetails(sameWeek.events(), weekly.id()).completed());
        assertTrue(todoDetails(sameWeek.events(), monthly.id()).completed());
        assertFalse(todoDetails(sameWeek.events(), daily.id()).completed());
        assertEquals("weekly", assertInstanceOf(TodoDetails.class, completedWeekly.details()).recurrence());

        var nextWeek = dailyEventService.getDay("recurring-user", LocalDate.of(2026, 9, 7));
        assertFalse(todoDetails(nextWeek.events(), weekly.id()).completed());
        assertTrue(todoDetails(nextWeek.events(), monthly.id()).completed());
        assertEquals(3, nextWeek.events().size());

        var summaries = dailyEventService.getDays("recurring-user", start, wednesday);
        assertEquals(3, summaries.getFirst().todoCount());
        assertEquals(1, summaries.get(1).todoCount());
        assertEquals(1, summaries.get(1).completedTodoCount());
    }

    @Test
    void scheduleCanBeCreatedWithoutStartOrEndTime() {
        LocalDate date = LocalDate.of(2026, 9, 10);
        DailyEvent created = dailyEventService.create(
                "optional-time-user", new ScheduleCommand(date, "等待确认的日程", null, null, null,
                        ZoneId.of("Asia/Shanghai")));

        ScheduleDetails details = assertInstanceOf(ScheduleDetails.class, created.details());
        assertEquals(null, details.startTime());
        assertEquals(null, details.endTime());
    }

    @Test
    void recurringTodoSummaryDoesNotProjectPendingWorkIntoFutureDays() {
        LocalDate today = LocalDate.now();
        dailyEventService.create(
                "recurring-cutoff-user", new TodoCommand(today, "每天学习", null, "medium", "daily"));

        var summaries = dailyEventService.getDays("recurring-cutoff-user", today, today.plusDays(3));

        assertEquals(1, summaries.size());
        assertEquals(today, summaries.getFirst().date());
        assertEquals(1, summaries.getFirst().todoCount());
    }

    @Test
    void journalCanBeUpdatedWithoutCreatingAnotherDailyEvent() {
        LocalDate date = LocalDate.of(2026, 9, 7);
        DailyEvent created = dailyEventService.create(
                "local-default", new JournalCommand(date, "初稿", "第一版正文", "平静"));

        DailyEvent updated = dailyEventService.updateJournal(
                "local-default", created.id(), created.version(),
                new JournalCommand(date, "复盘", "已经补充完整。", "充实"));

        assertEquals(1, updated.version());
        assertEquals("复盘", updated.title());
        assertEquals("已经补充完整。", assertInstanceOf(JournalDetails.class, updated.details()).body());
        assertEquals(1, dailyEventService.getDay("local-default", date).events().size());
    }

    @Test
    void structuredRecordTypesCanBeEditedThroughTheSameStableInterface() {
        LocalDate date = LocalDate.of(2026, 9, 8);
        DailyEvent todo = dailyEventService.create(
                "local-default", new TodoCommand(date, "旧待办", "08:00", "low"));
        DailyEvent schedule = dailyEventService.create(
                "local-default", new ScheduleCommand(date, "旧日程", "09:00", "10:00", null, ZoneId.of("Asia/Shanghai")));
        DailyEvent expense = dailyEventService.create(
                "local-default", new ExpenseCommand(date, "餐饮", "旧花销", new BigDecimal("12.00"), "12:00", "CNY"));

        DailyEvent updatedTodo = dailyEventService.update(
                "local-default", todo.id(), todo.version(), new TodoCommand(date, "新待办", "08:30", "high"));
        DailyEvent updatedSchedule = dailyEventService.update(
                "local-default", schedule.id(), schedule.version(),
                new ScheduleCommand(date, "新日程", "10:00", "11:00", "会议室", ZoneId.of("Asia/Shanghai")));
        DailyEvent updatedExpense = dailyEventService.update(
                "local-default", expense.id(), expense.version(),
                new ExpenseCommand(date, "学习", "新花销", new BigDecimal("39.90"), "19:00", "CNY"));

        assertEquals(todo.id(), updatedTodo.id());
        assertEquals("新待办", updatedTodo.title());
        assertEquals(schedule.id(), updatedSchedule.id());
        assertEquals("新日程", updatedSchedule.title());
        assertEquals(expense.id(), updatedExpense.id());
        assertEquals("新花销", updatedExpense.title());
        assertEquals(1, updatedTodo.version());
        assertEquals(1, updatedSchedule.version());
        assertEquals(1, updatedExpense.version());
    }

    @Test
    void concurrentLocalWritesAreRetriedWithoutLosingDailyEvents() throws Exception {
        LocalDate date = LocalDate.of(2026, 9, 9);
        var writes = java.util.stream.IntStream.range(0, 8)
                .mapToObj(index -> (Callable<DailyEvent>) () -> dailyEventService.create(
                        "local-default", new TodoCommand(date, "并发待办 " + index, null, "medium")))
                .toList();

        try (var executor = Executors.newFixedThreadPool(4)) {
            for (var result : executor.invokeAll(writes)) result.get();
        }

        assertEquals(8, dailyEventService.getDay("local-default", date).events().size());
    }

    private static Path createDatabasePath() {
        try {
            return Files.createTempDirectory("butvan-daily-event-test-").resolve("butvan.db");
        } catch (IOException exception) {
            throw new IllegalStateException("无法创建日记录测试数据库目录", exception);
        }
    }

    private static TodoDetails todoDetails(java.util.List<DailyEvent> events, String eventId) {
        return events.stream()
                .filter(event -> event.id().equals(eventId))
                .map(DailyEvent::details)
                .map(TodoDetails.class::cast)
                .findFirst()
                .orElseThrow();
    }
}
