package butvan.agent.network.daily.service;

import butvan.agent.network.daily.model.DailyEventModels.DailyDay;
import butvan.agent.network.daily.model.DailyEventModels.DailyDaySummary;
import butvan.agent.network.daily.model.DailyEventModels.DailyEventCommand;
import butvan.agent.network.daily.model.DailyEventModels.DailyEvent;
import butvan.agent.network.daily.repository.DailyEventRepository;
import butvan.agent.network.daily.repository.DailyEventRepository.DailyEventRow;
import butvan.agent.network.daily.type.DailyEventTypeRegistry;
import butvan.agent.network.daily.type.TodoTypeHandler;
import butvan.agent.network.daily.model.DailyEventModels.JournalCommand;
import butvan.agent.network.daily.model.DailyEventModels.ExpenseDetails;
import butvan.agent.network.daily.model.DailyEventModels.IncomeDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.UUID;
import java.util.stream.Collectors;

/** 日记录公开领域接口，隐藏 SQLite 与类型详情的持久化过程。 */
@Service
@RequiredArgsConstructor
public class DailyEventService {

    private final DailyEventRepository repository;
    private final DailyEventTypeRegistry typeRegistry;
    private final TodoTypeHandler todoTypeHandler;
    private final ExpenseAnalyticsService expenseAnalyticsService;

    /** 创建任意已注册类型的日记录。 */
    @Transactional
    public DailyEvent create(String ownerId, DailyEventCommand command) {
        validate(ownerId, command);
        String id = UUID.randomUUID().toString();
        Instant now = Instant.now();
        String title = command.title() == null || command.title().isBlank() ? "无标题记录" : command.title().trim();
        repository.insertEvent(id, ownerId, command.eventDate(), command.eventType(), title, now);
        typeRegistry.insert(id, command);
        return getDay(ownerId, command.eventDate()).events().stream()
                .filter(event -> event.id().equals(id))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("待办创建后无法读取"));
    }

    /** 查询某一天的全部日记录。 */
    @Transactional(readOnly = true)
    public DailyDay getDay(String ownerId, LocalDate date) {
        if (ownerId == null || ownerId.isBlank() || date == null) {
            throw new IllegalArgumentException("用户与日期不能为空");
        }
        List<DailyEventRow> rows = repository.findDay(ownerId, date);
        Map<String, List<String>> idsByType = rows.stream().collect(Collectors.groupingBy(
                DailyEventRow::eventType,
                Collectors.mapping(DailyEventRow::id, Collectors.toList())));
        Map<String, Object> detailsById = typeRegistry.loadDetails(idsByType);
        List<String> todoIds = idsByType.getOrDefault("todo", List.of());
        detailsById.putAll(todoTypeHandler.loadDetailsForOccurrence(todoIds, date));
        List<DailyEvent> events = new ArrayList<>(rows.stream().map(row -> new DailyEvent(
                row.id(), "todo".equals(row.eventType()) ? date : row.eventDate(), row.eventType(), row.title(), row.source(), row.status(),
                row.version(), row.createdAt(), row.updatedAt(), detailsById.get(row.id()))).toList());
        expenseAnalyticsService.findFinanceExpenses(ownerId, date).forEach(expense -> events.add(new DailyEvent(
                "finance-" + expense.id(), expense.date(), "expense", expense.note(), "finance", "confirmed",
                0, expense.createdAt(), expense.createdAt(), new ExpenseDetails(
                expense.category(), expense.note(), expense.amount(), expense.time().toString(), expense.currency()))));
        expenseAnalyticsService.findFinanceIncomes(ownerId, date).forEach(income -> events.add(new DailyEvent(
                "finance-income-" + income.id(), income.date(), "income", income.note(), "finance", "confirmed",
                0, income.createdAt(), income.createdAt(), new IncomeDetails(
                income.category(), income.note(), income.amount(), income.time().toString(), income.currency()))));
        events.sort(java.util.Comparator.comparing(DailyEvent::createdAt).thenComparing(DailyEvent::id));
        return new DailyDay(date, events);
    }

    /** 查询日期范围摘要。 */
    @Transactional(readOnly = true)
    public List<DailyDaySummary> getDays(String ownerId, LocalDate from, LocalDate to) {
        if (ownerId == null || ownerId.isBlank()) throw new IllegalArgumentException("用户不能为空");
        if (from == null || to == null || from.isAfter(to)) throw new IllegalArgumentException("日期范围不合法");
        Map<LocalDate, DailyDaySummary> summaries = repository.findDaySummaries(ownerId, from, to).stream()
                .collect(Collectors.toMap(DailyDaySummary::date, item -> item, (left, right) -> left, LinkedHashMap::new));
        LocalDate recurringSummaryEnd = to.isAfter(LocalDate.now()) ? LocalDate.now() : to;
        if (!from.isAfter(recurringSummaryEnd)) {
            repository.findRecurringTodoSummaries(ownerId, from, recurringSummaryEnd).forEach(recurring ->
                    summaries.compute(recurring.date(), (date, current) -> current == null
                            ? recurring
                            : new DailyDaySummary(date, current.eventCount() + recurring.eventCount(),
                            current.todoCount() + recurring.todoCount(),
                            current.completedTodoCount() + recurring.completedTodoCount(), current.scheduleCount(),
                            current.expenseTotal(), current.headline() == null ? recurring.headline() : current.headline())));
        }
        expenseAnalyticsService.analyze(ownerId, from, to).days().stream()
                .filter(day -> day.total().signum() > 0)
                .forEach(day -> summaries.compute(day.date(), (date, current) -> current == null
                        ? new DailyDaySummary(date, day.financeExpenseCount(), 0, 0, 0,
                        day.total(), day.financeHeadline())
                        : new DailyDaySummary(date, current.eventCount() + day.financeExpenseCount(),
                        current.todoCount(), current.completedTodoCount(), current.scheduleCount(),
                        day.total(), current.headline())));
        return summaries.values().stream().sorted(java.util.Comparator.comparing(DailyDaySummary::date)).toList();
    }

    /** 使用乐观版本检查修改待办完成状态。 */
    @Transactional
    public DailyEvent setTodoCompleted(
            String ownerId, String eventId, boolean completed, int expectedVersion, LocalDate occurrenceDate) {
        DailyEventRow row = requireEvent(ownerId, eventId);
        if (!"todo".equals(row.eventType())) throw new IllegalArgumentException("指定日记录不是待办");
        String recurrence = todoTypeHandler.findRecurrence(eventId);
        LocalDate effectiveDate = occurrenceDate == null ? row.eventDate() : occurrenceDate;
        if (effectiveDate.isBefore(row.eventDate()) || ("none".equals(recurrence) && !effectiveDate.equals(row.eventDate()))) {
            throw new IllegalArgumentException("待办完成日期不属于该待办");
        }
        todoTypeHandler.setCompleted(eventId, effectiveDate, recurrence, completed);
        if (!repository.advanceVersion(ownerId, eventId, expectedVersion, Instant.now())) {
            throw new IllegalStateException("日记录已被其他操作修改，请刷新后重试");
        }
        return getDay(ownerId, effectiveDate).events().stream()
                .filter(event -> event.id().equals(eventId))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("待办修改后无法读取"));
    }

    /** 兼容领域内未传出现日期的旧调用，普通待办仍以创建日期作为完成周期。 */
    public DailyEvent setTodoCompleted(String ownerId, String eventId, boolean completed, int expectedVersion) {
        return setTodoCompleted(ownerId, eventId, completed, expectedVersion, null);
    }

    /** 使用乐观版本检查删除日记录。 */
    @Transactional
    public void delete(String ownerId, String eventId, int expectedVersion) {
        requireEvent(ownerId, eventId);
        if (!repository.delete(ownerId, eventId, expectedVersion)) {
            throw new IllegalStateException("日记录已被其他操作修改，请刷新后重试");
        }
    }

    /** 更新现有手记，避免编辑操作产生重复记录。 */
    @Transactional
    public DailyEvent updateJournal(
            String ownerId, String eventId, int expectedVersion, JournalCommand command) {
        return update(ownerId, eventId, expectedVersion, command);
    }

    /** 通过类型处理器更新任意已注册日记录。 */
    @Transactional
    public DailyEvent update(
            String ownerId, String eventId, int expectedVersion, DailyEventCommand command) {
        validate(ownerId, command);
        DailyEventRow row = requireEvent(ownerId, eventId);
        if (!row.eventType().equals(command.eventType())) throw new IllegalArgumentException("日记录类型不能变更");
        typeRegistry.update(eventId, command);
        String title = command.title() == null || command.title().isBlank() ? "无标题记录" : command.title().trim();
        if (!repository.updateEvent(ownerId, eventId, expectedVersion, command.eventDate(), title, Instant.now())) {
            throw new IllegalStateException("日记录已被其他操作修改，请刷新后重试");
        }
        return getDay(ownerId, command.eventDate()).events().stream()
                .filter(event -> event.id().equals(eventId))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("手记修改后无法读取"));
    }

    private DailyEventRow requireEvent(String ownerId, String eventId) {
        if (ownerId == null || ownerId.isBlank() || eventId == null || eventId.isBlank()) {
            throw new IllegalArgumentException("用户与日记录 ID 不能为空");
        }
        return repository.findById(ownerId, eventId)
                .orElseThrow(() -> new IllegalArgumentException("日记录不存在"));
    }

    private void validate(String ownerId, DailyEventCommand command) {
        if (ownerId == null || ownerId.isBlank()) {
            throw new IllegalArgumentException("用户不能为空");
        }
        if (command == null || command.eventDate() == null) throw new IllegalArgumentException("日记录日期不能为空");
    }
}
