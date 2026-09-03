package butvan.agent.network.daily.type;

import butvan.agent.network.daily.model.DailyEventModels.JournalCommand;
import butvan.agent.network.daily.model.DailyEventModels.JournalDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 手记详情处理器。 */
@Component
@RequiredArgsConstructor
public class JournalTypeHandler implements DailyEventTypeHandler<JournalCommand> {
    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedJdbcTemplate;

    @Override public String eventType() { return "journal"; }
    @Override public Class<JournalCommand> commandType() { return JournalCommand.class; }

    @Override
    public void validate(JournalCommand command) {
        if ((command.title() == null || command.title().isBlank()) && (command.body() == null || command.body().isBlank())) {
            throw new IllegalArgumentException("手记标题和正文不能同时为空");
        }
    }

    @Override
    public void insert(String eventId, JournalCommand command) {
        jdbcTemplate.update("INSERT INTO journal_detail (event_id, body, mood) VALUES (?, ?, ?)",
                eventId, trim(command.body()), trim(command.mood()));
    }

    /** 覆盖保存现有手记详情。 */
    @Override
    public void update(String eventId, JournalCommand command) {
        int updated = jdbcTemplate.update(
                "UPDATE journal_detail SET body = ?, mood = ? WHERE event_id = ?",
                trim(command.body()), trim(command.mood()), eventId);
        if (updated != 1) throw new IllegalArgumentException("手记不存在");
    }

    @Override
    public Map<String, Object> loadDetails(List<String> eventIds) {
        if (eventIds.isEmpty()) return Map.of();
        return namedJdbcTemplate.query("SELECT event_id, body, mood FROM journal_detail WHERE event_id IN (:ids)",
                Map.of("ids", eventIds), resultSet -> {
                    Map<String, Object> result = new LinkedHashMap<>();
                    while (resultSet.next()) result.put(resultSet.getString("event_id"), new JournalDetails(
                            resultSet.getString("body"), resultSet.getString("mood")));
                    return result;
                });
    }

    private String trim(String value) { return value == null ? "" : value.trim(); }
}
