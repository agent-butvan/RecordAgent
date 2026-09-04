package butvan.agent.network.daily.type;

import butvan.agent.network.daily.model.DailyEventModels.TodoCommand;
import butvan.agent.network.daily.model.DailyEventModels.TodoDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 待办详情处理器。 */
@Component
@RequiredArgsConstructor
public class TodoTypeHandler implements DailyEventTypeHandler<TodoCommand> {
    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedJdbcTemplate;

    @Override public String eventType() { return "todo"; }
    @Override public Class<TodoCommand> commandType() { return TodoCommand.class; }

    @Override
    public void validate(TodoCommand command) {
        if (command.title() == null || command.title().isBlank()) throw new IllegalArgumentException("待办内容不能为空");
        if (!Set.of("high", "medium", "low").contains(command.priority())) throw new IllegalArgumentException("待办优先级不合法");
        if (!Set.of("none", "daily", "weekly", "monthly").contains(normalizeRecurrence(command.recurrence()))) {
            throw new IllegalArgumentException("待办周期不合法");
        }
        parseOptionalTime(command.time(), "待办时间不合法");
    }

    @Override
    public void insert(String eventId, TodoCommand command) {
        jdbcTemplate.update("INSERT INTO todo_detail (event_id, todo_time, priority, completed, recurrence) VALUES (?, ?, ?, 0, ?)",
                eventId, blankToNull(command.time()), command.priority(), normalizeRecurrence(command.recurrence()));
    }

    @Override
    public void update(String eventId, TodoCommand command) {
        int updated = jdbcTemplate.update(
                "UPDATE todo_detail SET todo_time = ?, priority = ?, recurrence = ? WHERE event_id = ?",
                blankToNull(command.time()), command.priority(), normalizeRecurrence(command.recurrence()), eventId);
        if (updated != 1) throw new IllegalArgumentException("待办不存在");
    }

    /** 修改待办完成状态。 */
    public void setCompleted(String eventId, LocalDate occurrenceDate, String recurrence, boolean completed) {
        String periodStart = periodStart(occurrenceDate, recurrence).toString();
        if (completed) {
            jdbcTemplate.update("""
                    INSERT INTO todo_completion (event_id, period_start, completed_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(event_id, period_start) DO UPDATE SET completed_at = excluded.completed_at
                    """, eventId, periodStart, java.time.Instant.now().toString());
        } else {
            jdbcTemplate.update("DELETE FROM todo_completion WHERE event_id = ? AND period_start = ?",
                    eventId, periodStart);
        }
    }

    /** 读取待办周期，供完成状态按日定位所属周期。 */
    public String findRecurrence(String eventId) {
        List<String> values = jdbcTemplate.query(
                "SELECT recurrence FROM todo_detail WHERE event_id = ?",
                (resultSet, rowNumber) -> resultSet.getString("recurrence"), eventId);
        if (values.isEmpty()) throw new IllegalArgumentException("待办不存在");
        return normalizeRecurrence(values.getFirst());
    }

    /** 按查询日期加载待办详情，周期待办的完成状态由所属日、周或月独立计算。 */
    public Map<String, Object> loadDetailsForOccurrence(List<String> eventIds, LocalDate occurrenceDate) {
        if (eventIds.isEmpty()) return Map.of();
        List<TodoRow> todos = namedJdbcTemplate.query("""
                SELECT event_id, todo_time, priority, recurrence
                FROM todo_detail
                WHERE event_id IN (:ids)
                """, Map.of("ids", eventIds), (resultSet, rowNumber) -> new TodoRow(
                resultSet.getString("event_id"), resultSet.getString("todo_time"),
                resultSet.getString("priority"), normalizeRecurrence(resultSet.getString("recurrence"))));
        Map<String, Set<String>> completions = namedJdbcTemplate.query("""
                SELECT event_id, period_start
                FROM todo_completion
                WHERE event_id IN (:ids)
                """, Map.of("ids", eventIds), resultSet -> {
                    Map<String, Set<String>> result = new LinkedHashMap<>();
                    while (resultSet.next()) {
                        result.computeIfAbsent(resultSet.getString("event_id"), ignored -> new java.util.HashSet<>())
                                .add(resultSet.getString("period_start"));
                    }
                    return result;
                });
        Map<String, Object> result = new LinkedHashMap<>();
        for (TodoRow todo : todos) {
            String key = periodStart(occurrenceDate, todo.recurrence()).toString();
            boolean completed = completions.getOrDefault(todo.eventId(), Set.of()).contains(key);
            result.put(todo.eventId(), new TodoDetails(
                    todo.time(), todo.priority(), completed, todo.recurrence()));
        }
        return result;
    }

    @Override
    public Map<String, Object> loadDetails(List<String> eventIds) {
        if (eventIds.isEmpty()) return Map.of();
        return namedJdbcTemplate.query("SELECT event_id, todo_time, priority, recurrence FROM todo_detail WHERE event_id IN (:ids)",
                Map.of("ids", eventIds), resultSet -> {
                    Map<String, Object> result = new java.util.LinkedHashMap<>();
                    while (resultSet.next()) result.put(resultSet.getString("event_id"), new TodoDetails(
                            resultSet.getString("todo_time"), resultSet.getString("priority"), false,
                            normalizeRecurrence(resultSet.getString("recurrence"))));
                    return result;
                });
    }

    private LocalDate periodStart(LocalDate date, String recurrence) {
        return switch (normalizeRecurrence(recurrence)) {
            case "weekly" -> date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case "monthly" -> date.withDayOfMonth(1);
            default -> date;
        };
    }

    private String normalizeRecurrence(String recurrence) {
        return recurrence == null || recurrence.isBlank() ? "none" : recurrence.trim();
    }

    private record TodoRow(String eventId, String time, String priority, String recurrence) {
    }

    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private void parseOptionalTime(String value, String message) {
        if (value == null || value.isBlank()) return;
        try {
            java.time.LocalTime.parse(value);
        } catch (java.time.format.DateTimeParseException exception) {
            throw new IllegalArgumentException(message);
        }
    }
}
