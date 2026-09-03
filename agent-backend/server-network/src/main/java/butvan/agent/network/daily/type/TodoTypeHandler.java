package butvan.agent.network.daily.type;

import butvan.agent.network.daily.model.DailyEventModels.TodoCommand;
import butvan.agent.network.daily.model.DailyEventModels.TodoDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

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
        parseOptionalTime(command.time(), "待办时间不合法");
    }

    @Override
    public void insert(String eventId, TodoCommand command) {
        jdbcTemplate.update("INSERT INTO todo_detail (event_id, todo_time, priority, completed) VALUES (?, ?, ?, 0)",
                eventId, blankToNull(command.time()), command.priority());
    }

    @Override
    public void update(String eventId, TodoCommand command) {
        int updated = jdbcTemplate.update(
                "UPDATE todo_detail SET todo_time = ?, priority = ? WHERE event_id = ?",
                blankToNull(command.time()), command.priority(), eventId);
        if (updated != 1) throw new IllegalArgumentException("待办不存在");
    }

    /** 修改待办完成状态。 */
    public void setCompleted(String eventId, boolean completed) {
        int updated = jdbcTemplate.update("""
                UPDATE todo_detail
                SET completed = ?, completed_at = ?
                WHERE event_id = ?
                """, completed ? 1 : 0, completed ? java.time.Instant.now().toString() : null, eventId);
        if (updated != 1) throw new IllegalArgumentException("待办不存在");
    }

    @Override
    public Map<String, Object> loadDetails(List<String> eventIds) {
        if (eventIds.isEmpty()) return Map.of();
        return namedJdbcTemplate.query("SELECT event_id, todo_time, priority, completed FROM todo_detail WHERE event_id IN (:ids)",
                Map.of("ids", eventIds), resultSet -> {
                    Map<String, Object> result = new java.util.LinkedHashMap<>();
                    while (resultSet.next()) result.put(resultSet.getString("event_id"), new TodoDetails(
                            resultSet.getString("todo_time"), resultSet.getString("priority"), resultSet.getBoolean("completed")));
                    return result;
                });
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
