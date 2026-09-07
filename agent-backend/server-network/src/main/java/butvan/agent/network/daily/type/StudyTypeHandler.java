package butvan.agent.network.daily.type;

import butvan.agent.network.study.model.StudyModels.StudyCommand;
import butvan.agent.network.study.model.StudyModels.StudyDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 学习时段详情处理器。 */
@Component
@RequiredArgsConstructor
public class StudyTypeHandler implements DailyEventTypeHandler<StudyCommand> {
    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedJdbcTemplate;

    @Override public String eventType() { return "study"; }
    @Override public Class<StudyCommand> commandType() { return StudyCommand.class; }

    @Override
    public void validate(StudyCommand command) {
        if (command.content() == null || command.content().isBlank()) {
            throw new IllegalArgumentException("学习内容不能为空");
        }
        if (command.content().trim().length() > 200) throw new IllegalArgumentException("学习内容不能超过 200 个字符");
        if (command.category() == null || command.category().isBlank()) throw new IllegalArgumentException("学习分类不能为空");
        if (command.category().trim().length() > 40) throw new IllegalArgumentException("学习分类不能超过 40 个字符");
        if (command.startedAt() == null) throw new IllegalArgumentException("学习开始时间不能为空");
        if (command.endedAt() != null && !command.startedAt().isBefore(command.endedAt())) {
            throw new IllegalArgumentException("学习结束时间必须晚于开始时间");
        }
        if (command.timezone() == null) throw new IllegalArgumentException("学习时区不能为空");
    }

    @Override
    public void insert(String eventId, StudyCommand command) {
        jdbcTemplate.update("""
                INSERT INTO study_session_detail (event_id, started_at, ended_at, category, timezone, location)
                VALUES (?, ?, ?, ?, ?, ?)
                """, eventId, command.startedAt().toString(),
                command.endedAt() == null ? null : command.endedAt().toString(),
                command.category().trim(), command.timezone().getId(), command.location());
    }

    @Override
    public void update(String eventId, StudyCommand command) {
        int updated = jdbcTemplate.update("""
                UPDATE study_session_detail
                SET started_at = ?, ended_at = ?, category = ?, timezone = ?, location = ?
                WHERE event_id = ?
                """, command.startedAt().toString(), command.endedAt() == null ? null : command.endedAt().toString(),
                command.category().trim(), command.timezone().getId(), command.location(), eventId);
        if (updated != 1) throw new IllegalArgumentException("学习时段不存在");
    }

    @Override
    public Map<String, Object> loadDetails(List<String> eventIds) {
        if (eventIds.isEmpty()) return Map.of();
        return namedJdbcTemplate.query("""
                SELECT event_id, started_at, ended_at, category, timezone, location
                FROM study_session_detail WHERE event_id IN (:ids)
                """, Map.of("ids", eventIds), resultSet -> {
                    Map<String, Object> result = new LinkedHashMap<>();
                    while (resultSet.next()) result.put(resultSet.getString("event_id"), new StudyDetails(
                            resultSet.getString("started_at"), resultSet.getString("ended_at"),
                            resultSet.getString("category"), resultSet.getString("timezone"), resultSet.getString("location")));
                    return result;
                });
    }
}
