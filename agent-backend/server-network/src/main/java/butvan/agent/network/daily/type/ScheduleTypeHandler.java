package butvan.agent.network.daily.type;

import butvan.agent.network.daily.model.DailyEventModels.ScheduleCommand;
import butvan.agent.network.daily.model.DailyEventModels.ScheduleDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 日程详情处理器。 */
@Component
@RequiredArgsConstructor
public class ScheduleTypeHandler implements DailyEventTypeHandler<ScheduleCommand> {
    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedJdbcTemplate;

    @Override public String eventType() { return "schedule"; }
    @Override public Class<ScheduleCommand> commandType() { return ScheduleCommand.class; }

    @Override
    public void validate(ScheduleCommand command) {
        if (command.title() == null || command.title().isBlank()) throw new IllegalArgumentException("日程名称不能为空");
        java.time.LocalTime start;
        java.time.LocalTime end;
        try {
            start = java.time.LocalTime.parse(command.startTime());
            end = java.time.LocalTime.parse(command.endTime());
        } catch (java.time.format.DateTimeParseException | NullPointerException exception) {
            throw new IllegalArgumentException("日程时间不合法");
        }
        if (!start.isBefore(end)) {
            throw new IllegalArgumentException("日程结束时间必须晚于开始时间");
        }
        if (command.timezone() == null) throw new IllegalArgumentException("日程时区不能为空");
    }

    @Override
    public void insert(String eventId, ScheduleCommand command) {
        jdbcTemplate.update("INSERT INTO schedule_detail (event_id, start_time, end_time, location, timezone) VALUES (?, ?, ?, ?, ?)",
                eventId, command.startTime(), command.endTime(), blankToNull(command.location()), command.timezone().getId());
    }

    @Override
    public void update(String eventId, ScheduleCommand command) {
        int updated = jdbcTemplate.update("""
                UPDATE schedule_detail
                SET start_time = ?, end_time = ?, location = ?, timezone = ?
                WHERE event_id = ?
                """, command.startTime(), command.endTime(), blankToNull(command.location()),
                command.timezone().getId(), eventId);
        if (updated != 1) throw new IllegalArgumentException("日程不存在");
    }

    @Override
    public Map<String, Object> loadDetails(List<String> eventIds) {
        if (eventIds.isEmpty()) return Map.of();
        return namedJdbcTemplate.query("SELECT event_id, start_time, end_time, location, timezone FROM schedule_detail WHERE event_id IN (:ids)",
                Map.of("ids", eventIds), resultSet -> {
                    Map<String, Object> result = new LinkedHashMap<>();
                    while (resultSet.next()) result.put(resultSet.getString("event_id"), new ScheduleDetails(
                            resultSet.getString("start_time"), resultSet.getString("end_time"),
                            resultSet.getString("location"), resultSet.getString("timezone")));
                    return result;
                });
    }

    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
