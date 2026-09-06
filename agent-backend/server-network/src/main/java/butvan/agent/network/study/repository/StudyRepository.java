package butvan.agent.network.study.repository;

import butvan.agent.network.study.model.StudyModels.StudySession;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/** SQLite 学习时段读取与约束查询适配器。 */
@Repository
@RequiredArgsConstructor
public class StudyRepository {
    private final JdbcTemplate jdbcTemplate;

    /** 查询当前进行中的学习时段。 */
    public Optional<StudySession> findActive(String ownerId, Instant now) {
        return query("""
                SELECT e.id, e.title, e.source, e.status, e.version,
                       s.category, s.started_at, s.ended_at, s.timezone
                FROM daily_event e
                JOIN study_session_detail s ON s.event_id = e.id
                WHERE e.owner_id = ? AND e.event_type = 'study' AND e.status = 'active'
                LIMIT 1
                """, now, ownerId).stream().findFirst();
    }

    /** 按所有者查询单条学习时段。 */
    public Optional<StudySession> findById(String ownerId, String eventId, Instant now) {
        return query("""
                SELECT e.id, e.title, e.source, e.status, e.version,
                       s.category, s.started_at, s.ended_at, s.timezone
                FROM daily_event e
                JOIN study_session_detail s ON s.event_id = e.id
                WHERE e.owner_id = ? AND e.event_type = 'study' AND e.id = ?
                """, now, ownerId, eventId).stream().findFirst();
    }

    /** 查询与给定绝对时间范围相交的学习时段。 */
    public List<StudySession> findRange(String ownerId, Instant from, Instant toExclusive, Instant now) {
        return query("""
                SELECT e.id, e.title, e.source, e.status, e.version,
                       s.category, s.started_at, s.ended_at, s.timezone
                FROM daily_event e
                JOIN study_session_detail s ON s.event_id = e.id
                WHERE e.owner_id = ? AND e.event_type = 'study'
                  AND julianday(s.started_at) < julianday(?)
                  AND julianday(COALESCE(s.ended_at, ?)) > julianday(?)
                ORDER BY julianday(s.started_at) DESC, e.id DESC
                """, now, ownerId, toExclusive.toString(), now.toString(), from.toString());
    }

    /** 判断是否存在与候选时段重叠的其他记录。 */
    public boolean hasOverlap(String ownerId, Instant startedAt, Instant endedAt, String excludedId, Instant now) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM daily_event e
                JOIN study_session_detail s ON s.event_id = e.id
                WHERE e.owner_id = ? AND e.event_type = 'study'
                  AND (? IS NULL OR e.id <> ?)
                  AND julianday(s.started_at) < julianday(?)
                  AND julianday(COALESCE(s.ended_at, ?)) > julianday(?)
                """, Integer.class, ownerId, excludedId, excludedId, endedAt.toString(), now.toString(), startedAt.toString());
        return count != null && count > 0;
    }

    private List<StudySession> query(String sql, Instant now, Object... arguments) {
        return jdbcTemplate.query(sql, (resultSet, rowNumber) -> map(resultSet, now), arguments);
    }

    private StudySession map(ResultSet resultSet, Instant now) throws SQLException {
        Instant startedAt = Instant.parse(resultSet.getString("started_at"));
        String endedValue = resultSet.getString("ended_at");
        Instant endedAt = endedValue == null ? null : Instant.parse(endedValue);
        Instant durationEnd = endedAt == null ? now : endedAt;
        return new StudySession(
                resultSet.getString("id"), resultSet.getString("title"), resultSet.getString("category"),
                startedAt, endedAt, resultSet.getString("timezone"), resultSet.getString("source"),
                resultSet.getString("status"), Math.max(0, Duration.between(startedAt, durationEnd).getSeconds()),
                resultSet.getInt("version"));
    }
}
