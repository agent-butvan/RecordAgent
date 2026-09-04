package butvan.agent.network.daily.repository;

import butvan.agent.network.daily.model.DailyEventModels.DailyDaySummary;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/** SQLite 日记录持久化适配器。 */
@Repository
@RequiredArgsConstructor
public class DailyEventRepository {

    /** 日记录公共字段的内部持久化投影。 */
    public record DailyEventRow(
            String id,
            LocalDate eventDate,
            String eventType,
            String title,
            String source,
            String status,
            int version,
            Instant createdAt,
            Instant updatedAt) {
    }

    private final JdbcTemplate jdbcTemplate;

    /** 插入日记录公共字段。 */
    public void insertEvent(String id, String ownerId, LocalDate date, String type, String title, Instant now) {
        jdbcTemplate.update("""
                INSERT INTO daily_event (
                    id, owner_id, event_date, event_type, title, source, status,
                    extension_json, version, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 'manual', 'confirmed', '{}', 0, ?, ?)
                """, id, ownerId, date.toString(), type, title, now.toString(), now.toString());
    }

    /** 查询某日全部日记录的公共字段。 */
    public List<DailyEventRow> findDay(String ownerId, LocalDate date) {
        return jdbcTemplate.query("""
                SELECT id, event_date, event_type, title, source, status,
                       version, created_at, updated_at
                FROM daily_event e
                LEFT JOIN todo_detail t ON t.event_id = e.id
                WHERE e.owner_id = ?
                  AND (
                    e.event_date = ?
                    OR (e.event_type = 'todo' AND e.event_date <= ? AND COALESCE(t.recurrence, 'none') <> 'none')
                  )
                ORDER BY created_at ASC, id ASC
                """, (resultSet, rowNumber) -> new DailyEventRow(
                resultSet.getString("id"),
                LocalDate.parse(resultSet.getString("event_date")),
                resultSet.getString("event_type"),
                resultSet.getString("title"),
                resultSet.getString("source"),
                resultSet.getString("status"),
                resultSet.getInt("version"),
                Instant.parse(resultSet.getString("created_at")),
                Instant.parse(resultSet.getString("updated_at"))), ownerId, date.toString(), date.toString());
    }

    /** 按所有者读取一条日记录，防止跨用户修改。 */
    public Optional<DailyEventRow> findById(String ownerId, String eventId) {
        List<DailyEventRow> rows = jdbcTemplate.query("""
                SELECT id, event_date, event_type, title, source, status,
                       version, created_at, updated_at
                FROM daily_event
                WHERE owner_id = ? AND id = ?
                """, (resultSet, rowNumber) -> new DailyEventRow(
                resultSet.getString("id"), LocalDate.parse(resultSet.getString("event_date")),
                resultSet.getString("event_type"), resultSet.getString("title"),
                resultSet.getString("source"), resultSet.getString("status"),
                resultSet.getInt("version"), Instant.parse(resultSet.getString("created_at")),
                Instant.parse(resultSet.getString("updated_at"))), ownerId, eventId);
        return rows.stream().findFirst();
    }

    /** 以乐观版本推进日记录版本号。 */
    public boolean advanceVersion(String ownerId, String eventId, int expectedVersion, Instant now) {
        return jdbcTemplate.update("""
                UPDATE daily_event
                SET version = version + 1, updated_at = ?
                WHERE owner_id = ? AND id = ? AND version = ?
                """, now.toString(), ownerId, eventId, expectedVersion) == 1;
    }

    /** 修改日记录公共字段并推进乐观版本。 */
    public boolean updateEvent(
            String ownerId, String eventId, int expectedVersion, LocalDate date, String title, Instant now) {
        return jdbcTemplate.update("""
                UPDATE daily_event
                SET event_date = ?, title = ?, version = version + 1, updated_at = ?
                WHERE owner_id = ? AND id = ? AND version = ?
                """, date.toString(), title, now.toString(), ownerId, eventId, expectedVersion) == 1;
    }

    /** 按所有者和版本删除日记录，详情由外键级联清理。 */
    public boolean delete(String ownerId, String eventId, int expectedVersion) {
        return jdbcTemplate.update(
                "DELETE FROM daily_event WHERE owner_id = ? AND id = ? AND version = ?",
                ownerId, eventId, expectedVersion) == 1;
    }

    /** 查询日期范围内每天的轻量汇总，避免月视图加载手记正文。 */
    public List<DailyDaySummary> findDaySummaries(String ownerId, LocalDate from, LocalDate to) {
        return jdbcTemplate.query("""
                SELECT e.event_date,
                       COUNT(*) AS event_count,
                       SUM(CASE WHEN e.event_type = 'todo' THEN 1 ELSE 0 END) AS todo_count,
                       SUM(CASE WHEN e.event_type = 'todo' AND EXISTS (
                           SELECT 1 FROM todo_completion c
                           WHERE c.event_id = e.id AND c.period_start = e.event_date
                       ) THEN 1 ELSE 0 END) AS completed_todo_count,
                       SUM(CASE WHEN e.event_type = 'schedule' THEN 1 ELSE 0 END) AS schedule_count,
                       COALESCE(SUM(x.amount_minor), 0) AS expense_total_minor,
                       (SELECT h.title
                        FROM daily_event h
                        WHERE h.owner_id = e.owner_id AND h.event_date = e.event_date
                        ORDER BY h.created_at ASC, h.id ASC
                        LIMIT 1) AS headline
                FROM daily_event e
                LEFT JOIN todo_detail t ON t.event_id = e.id
                LEFT JOIN expense_detail x ON x.event_id = e.id
                WHERE e.owner_id = ? AND e.event_date BETWEEN ? AND ?
                  AND NOT (e.event_type = 'todo' AND COALESCE(t.recurrence, 'none') <> 'none')
                GROUP BY e.event_date
                ORDER BY e.event_date
                """, (resultSet, rowNumber) -> new DailyDaySummary(
                LocalDate.parse(resultSet.getString("event_date")),
                resultSet.getInt("event_count"),
                resultSet.getInt("todo_count"),
                resultSet.getInt("completed_todo_count"),
                resultSet.getInt("schedule_count"),
                BigDecimal.valueOf(resultSet.getLong("expense_total_minor"), 2),
                resultSet.getString("headline")), ownerId, from.toString(), to.toString());
    }

    /** 查询日期范围内周期待办的逐日轻量汇总，不加载其他类型详情。 */
    public List<DailyDaySummary> findRecurringTodoSummaries(String ownerId, LocalDate from, LocalDate to) {
        return jdbcTemplate.query("""
                WITH RECURSIVE dates(event_date) AS (
                    SELECT ?
                    UNION ALL
                    SELECT date(event_date, '+1 day') FROM dates WHERE event_date < ?
                )
                SELECT dates.event_date,
                       COUNT(*) AS todo_count,
                       SUM(CASE WHEN EXISTS (
                           SELECT 1 FROM todo_completion c
                           WHERE c.event_id = e.id
                             AND c.period_start = CASE t.recurrence
                               WHEN 'weekly' THEN date(dates.event_date, '-' || ((CAST(strftime('%w', dates.event_date) AS INTEGER) + 6) % 7) || ' days')
                               WHEN 'monthly' THEN date(dates.event_date, 'start of month')
                               ELSE dates.event_date
                             END
                       ) THEN 1 ELSE 0 END) AS completed_count,
                       MIN(e.title) AS headline
                FROM dates
                JOIN daily_event e ON e.owner_id = ? AND e.event_type = 'todo' AND e.event_date <= dates.event_date
                JOIN todo_detail t ON t.event_id = e.id
                  AND (
                    t.recurrence = 'daily'
                    OR (t.recurrence = 'weekly' AND (dates.event_date = e.event_date OR strftime('%w', dates.event_date) = '1'))
                    OR (t.recurrence = 'monthly' AND (dates.event_date = e.event_date OR strftime('%d', dates.event_date) = '01'))
                  )
                GROUP BY dates.event_date
                ORDER BY dates.event_date
                """, (resultSet, rowNumber) -> new DailyDaySummary(
                LocalDate.parse(resultSet.getString("event_date")),
                resultSet.getInt("todo_count"),
                resultSet.getInt("todo_count"),
                resultSet.getInt("completed_count"),
                0,
                BigDecimal.ZERO,
                resultSet.getString("headline")), from.toString(), to.toString(), ownerId);
    }
}
