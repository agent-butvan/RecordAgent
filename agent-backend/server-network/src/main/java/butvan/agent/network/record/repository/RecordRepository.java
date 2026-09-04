package butvan.agent.network.record.repository;

import butvan.agent.network.record.model.RecordModels.DaySummary;
import butvan.agent.network.record.model.RecordModels.RecordEntry;
import butvan.agent.network.record.model.RecordModels.RecordType;
import butvan.agent.network.record.model.RecordModels.RecordAttachment;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/** 记录领域 SQLite 持久化适配器。 */
@Repository
@RequiredArgsConstructor
public class RecordRepository {
    private final JdbcTemplate jdbcTemplate;

    /** 查询日期范围内的正常记录，可选按类型、标签和正文关键词过滤。 */
    public List<RecordEntry> search(String ownerId, LocalDate from, LocalDate to, String type, String tag, String query) {
        String like = "%" + (query == null ? "" : query.trim()) + "%";
        return jdbcTemplate.query("""
                SELECT DISTINCT r.* FROM record_entry r
                LEFT JOIN record_entry_tag rt ON rt.record_id = r.id
                LEFT JOIN record_tag t ON t.id = rt.tag_id
                WHERE r.owner_id = ? AND r.record_date BETWEEN ? AND ? AND r.trashed_at IS NULL
                  AND r.archived = 0 AND (? = '' OR r.record_type = ?)
                  AND (? = '' OR t.name = ?) AND (? = '%%' OR r.title LIKE ? OR r.content_text LIKE ?)
                ORDER BY r.pinned DESC, r.record_date DESC, r.updated_at DESC
                """, (rs, rowNum) -> map(rs, findTags(rs.getString("id"))), ownerId, from.toString(), to.toString(),
                safe(type), safe(type), safe(tag), safe(tag), like, like, like);
    }

    /** 查询回收站记录。 */
    public List<RecordEntry> findTrash(String ownerId) {
        return jdbcTemplate.query("SELECT * FROM record_entry WHERE owner_id = ? AND trashed_at IS NOT NULL ORDER BY trashed_at DESC",
                (rs, rowNum) -> map(rs, findTags(rs.getString("id"))), ownerId);
    }

    /** 查询用户全部记录（含归档和回收站），供完整备份使用。 */
    public List<RecordEntry> findAll(String ownerId) {
        return jdbcTemplate.query("SELECT * FROM record_entry WHERE owner_id = ? ORDER BY created_at, id",
                (rs, rowNum) -> map(rs, findTags(rs.getString("id"))), ownerId);
    }

    /** 按所有者和 ID 查询记录。 */
    public Optional<RecordEntry> find(String ownerId, String id) {
        return jdbcTemplate.query("SELECT * FROM record_entry WHERE owner_id = ? AND id = ?",
                (rs, rowNum) -> map(rs, findTags(id)), ownerId, id).stream().findFirst();
    }

    /** 插入记录主数据。 */
    public void insert(String id, String ownerId, LocalDate date, RecordType type, String title, String html,
                       String text, Integer weekYear, Integer weekNumber, Instant now) {
        jdbcTemplate.update("""
                INSERT INTO record_entry (id, owner_id, record_date, record_type, title, content_html, content_text,
                    week_year, week_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, id, ownerId, date.toString(), type.value(), title, html, text, weekYear, weekNumber,
                now.toString(), now.toString());
    }

    /** 以乐观锁覆盖可编辑内容。 */
    public boolean update(String ownerId, String id, int version, LocalDate date, RecordType type, String title,
                          String html, String text, Integer weekYear, Integer weekNumber, Instant now) {
        return jdbcTemplate.update("""
                UPDATE record_entry SET record_date = ?, record_type = ?, title = ?, content_html = ?, content_text = ?,
                    week_year = ?, week_number = ?, version = version + 1, updated_at = ?
                WHERE owner_id = ? AND id = ? AND version = ? AND trashed_at IS NULL
                """, date.toString(), type.value(), title, html, text, weekYear, weekNumber, now.toString(),
                ownerId, id, version) == 1;
    }

    /** 修改记录的展示状态。 */
    public boolean updateFlags(String ownerId, String id, int version, boolean pinned, boolean favorite,
                               boolean archived, Instant now) {
        return jdbcTemplate.update("""
                UPDATE record_entry SET pinned = ?, favorite = ?, archived = ?, version = version + 1, updated_at = ?
                WHERE owner_id = ? AND id = ? AND version = ? AND trashed_at IS NULL
                """, pinned, favorite, archived, now.toString(), ownerId, id, version) == 1;
    }

    /** 软删除或恢复记录。 */
    public boolean setTrashed(String ownerId, String id, int version, Instant trashedAt, Instant now) {
        return jdbcTemplate.update("""
                UPDATE record_entry SET trashed_at = ?, version = version + 1, updated_at = ?
                WHERE owner_id = ? AND id = ? AND version = ?
                """, trashedAt == null ? null : trashedAt.toString(), now.toString(), ownerId, id, version) == 1;
    }

    /** 永久清空当前用户回收站，关联标签和附件元数据由外键级联清理。 */
    public int clearTrash(String ownerId) {
        return jdbcTemplate.update("DELETE FROM record_entry WHERE owner_id = ? AND trashed_at IS NOT NULL", ownerId);
    }

    /** 导入完整备份前清除当前用户的记录数据。 */
    public int clearAll(String ownerId) { return jdbcTemplate.update("DELETE FROM record_entry WHERE owner_id = ?", ownerId); }

    /** 保存附件元数据。 */
    public void insertAttachment(RecordAttachment attachment) {
        jdbcTemplate.update("""
                INSERT INTO record_attachment (id, record_id, original_name, stored_name, media_type, size_bytes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, attachment.id(), attachment.recordId(), attachment.originalName(), attachment.storedName(),
                attachment.mediaType(), attachment.sizeBytes(), attachment.createdAt().toString());
    }

    /** 查询一条记录的全部附件。 */
    public List<RecordAttachment> findAttachments(String ownerId, String recordId) {
        return jdbcTemplate.query("""
                SELECT a.* FROM record_attachment a JOIN record_entry r ON r.id = a.record_id
                WHERE r.owner_id = ? AND r.id = ? ORDER BY a.created_at
                """, (rs, rowNum) -> mapAttachment(rs), ownerId, recordId);
    }

    /** 查询指定用户拥有的附件。 */
    public Optional<RecordAttachment> findAttachment(String ownerId, String recordId, String attachmentId) {
        return jdbcTemplate.query("""
                SELECT a.* FROM record_attachment a JOIN record_entry r ON r.id = a.record_id
                WHERE r.owner_id = ? AND r.id = ? AND a.id = ?
                """, (rs, rowNum) -> mapAttachment(rs), ownerId, recordId, attachmentId).stream().findFirst();
    }

    /** 删除附件元数据。 */
    public boolean deleteAttachment(String ownerId, String recordId, String attachmentId) {
        return jdbcTemplate.update("""
                DELETE FROM record_attachment WHERE id = ? AND record_id = ?
                  AND EXISTS (SELECT 1 FROM record_entry WHERE id = ? AND owner_id = ?)
                """, attachmentId, recordId, recordId, ownerId) == 1;
    }

    /** 替换一条记录的全部标签。 */
    public void replaceTags(String ownerId, String recordId, List<String> tags, Instant now) {
        jdbcTemplate.update("DELETE FROM record_entry_tag WHERE record_id = ?", recordId);
        for (String raw : tags == null ? List.<String>of() : tags) {
            String name = raw == null ? "" : raw.trim();
            if (name.isEmpty()) continue;
            jdbcTemplate.update("INSERT OR IGNORE INTO record_tag (id, owner_id, name, created_at) VALUES (?, ?, ?, ?)",
                    java.util.UUID.randomUUID().toString(), ownerId, name, now.toString());
            jdbcTemplate.update("""
                    INSERT OR IGNORE INTO record_entry_tag (record_id, tag_id)
                    SELECT ?, id FROM record_tag WHERE owner_id = ? AND name = ?
                    """, recordId, ownerId, name);
        }
    }

    /** 查询范围内日历计数及周复盘完成标记。 */
    public List<DaySummary> summarizeDays(String ownerId, LocalDate from, LocalDate to) {
        return jdbcTemplate.query("""
                SELECT record_date, COUNT(*) AS record_count,
                       MAX(CASE WHEN record_type = 'weekly_review' THEN 1 ELSE 0 END) AS reviewed
                FROM record_entry WHERE owner_id = ? AND record_date BETWEEN ? AND ?
                  AND trashed_at IS NULL AND archived = 0 GROUP BY record_date ORDER BY record_date
                """, (rs, rowNum) -> new DaySummary(LocalDate.parse(rs.getString("record_date")),
                rs.getInt("record_count"), rs.getBoolean("reviewed")), ownerId, from.toString(), to.toString());
    }

    private List<String> findTags(String recordId) {
        return jdbcTemplate.queryForList("""
                SELECT t.name FROM record_tag t JOIN record_entry_tag rt ON rt.tag_id = t.id
                WHERE rt.record_id = ? ORDER BY t.name
                """, String.class, recordId);
    }

    private RecordEntry map(ResultSet rs, List<String> tags) throws SQLException {
        String trashedAt = rs.getString("trashed_at");
        return new RecordEntry(rs.getString("id"), LocalDate.parse(rs.getString("record_date")),
                RecordType.parse(rs.getString("record_type")), rs.getString("title"), rs.getString("content_html"),
                rs.getString("content_text"), tags, rs.getBoolean("pinned"), rs.getBoolean("favorite"),
                rs.getBoolean("archived"), trashedAt == null ? null : Instant.parse(trashedAt),
                (Integer) rs.getObject("week_year"), (Integer) rs.getObject("week_number"), rs.getInt("version"),
                Instant.parse(rs.getString("created_at")), Instant.parse(rs.getString("updated_at")));
    }

    private RecordAttachment mapAttachment(ResultSet rs) throws SQLException {
        return new RecordAttachment(rs.getString("id"), rs.getString("record_id"), rs.getString("original_name"),
                rs.getString("stored_name"), rs.getString("media_type"), rs.getLong("size_bytes"),
                Instant.parse(rs.getString("created_at")));
    }

    private String safe(String value) { return value == null ? "" : value.trim(); }
}
