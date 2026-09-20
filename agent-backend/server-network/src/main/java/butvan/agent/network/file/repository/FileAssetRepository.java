package butvan.agent.network.file.repository;

import butvan.agent.network.file.model.FileAsset;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/** 通用文件资产及其业务绑定的 SQLite 持久化适配器。 */
@Repository
@RequiredArgsConstructor
public class FileAssetRepository {
    private final JdbcTemplate jdbcTemplate;

    public void insert(FileAsset asset) {
        jdbcTemplate.update("""
                INSERT INTO file_asset (id, owner_id, original_name, media_type, size_bytes, sha256, backend_type,
                    storage_profile_id, storage_key, status, created_at, updated_at, deleted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, asset.id(), asset.ownerId(), asset.originalName(), asset.mediaType(), asset.sizeBytes(),
                asset.sha256(), asset.backendType(), asset.storageProfileId(), asset.storageKey(), asset.status(),
                asset.createdAt().toString(), asset.updatedAt().toString(), null);
    }

    public void bind(String bindingId, String fileId, String ownerId, String domainType,
                     String domainId, String role, Instant createdAt) {
        jdbcTemplate.update("""
                INSERT INTO file_binding (id, file_id, owner_id, domain_type, domain_id, role, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, bindingId, fileId, ownerId, domainType, domainId, role, createdAt.toString());
    }

    public List<FileAsset> findBound(String ownerId, String domainType, String domainId, String role) {
        return jdbcTemplate.query("""
                SELECT f.* FROM file_asset f
                JOIN file_binding b ON b.file_id = f.id
                WHERE b.owner_id = ? AND b.domain_type = ? AND b.domain_id = ? AND b.role = ?
                  AND f.status = 'AVAILABLE'
                ORDER BY b.created_at, f.id
                """, (rs, rowNumber) -> map(rs), ownerId, domainType, domainId, role);
    }

    public Optional<FileAsset> findBoundFile(String ownerId, String fileId, String domainType,
                                             String domainId, String role) {
        return jdbcTemplate.query("""
                SELECT f.* FROM file_asset f
                JOIN file_binding b ON b.file_id = f.id
                WHERE f.id = ? AND b.owner_id = ? AND b.domain_type = ? AND b.domain_id = ? AND b.role = ?
                  AND f.status = 'AVAILABLE'
                """, (rs, rowNumber) -> map(rs), fileId, ownerId, domainType, domainId, role)
                .stream().findFirst();
    }

    public boolean unbind(String ownerId, String fileId, String domainType, String domainId, String role) {
        return jdbcTemplate.update("""
                DELETE FROM file_binding
                WHERE owner_id = ? AND file_id = ? AND domain_type = ? AND domain_id = ? AND role = ?
                """, ownerId, fileId, domainType, domainId, role) == 1;
    }

    public int countBindings(String fileId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM file_binding WHERE file_id = ?", Integer.class, fileId);
        return count == null ? 0 : count;
    }

    public void markDeleting(String ownerId, String fileId, Instant now) {
        jdbcTemplate.update("""
                UPDATE file_asset SET status = 'DELETING', updated_at = ?
                WHERE owner_id = ? AND id = ? AND status = 'AVAILABLE'
                """, now.toString(), ownerId, fileId);
    }

    public void deleteMetadata(String ownerId, String fileId) {
        jdbcTemplate.update("DELETE FROM file_asset WHERE owner_id = ? AND id = ?", ownerId, fileId);
    }

    private FileAsset map(ResultSet resultSet) throws SQLException {
        String deletedAt = resultSet.getString("deleted_at");
        return new FileAsset(
                resultSet.getString("id"), resultSet.getString("owner_id"), resultSet.getString("original_name"),
                resultSet.getString("media_type"), resultSet.getLong("size_bytes"), resultSet.getString("sha256"),
                resultSet.getString("backend_type"), resultSet.getString("storage_profile_id"),
                resultSet.getString("storage_key"), resultSet.getString("status"),
                Instant.parse(resultSet.getString("created_at")), Instant.parse(resultSet.getString("updated_at")),
                deletedAt == null ? null : Instant.parse(deletedAt));
    }
}
