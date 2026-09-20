package butvan.agent.network.file;

import butvan.agent.network.config.database.LocalDatabaseProperties;
import butvan.agent.network.file.repository.FileAssetRepository;
import butvan.agent.network.file.service.FileAssetService;
import butvan.agent.network.file.storage.LocalBlobStore;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.sqlite.SQLiteDataSource;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;

/** 验证 V16 会保留既有资料附件的元数据与物理内容可读性。 */
class FileAssetMigrationTest {

    @TempDir
    private Path temporaryDirectory;

    @Test
    void migratesLegacyRecordAttachmentIntoFileAsset() throws Exception {
        Path databasePath = temporaryDirectory.resolve("butvan.db");
        SQLiteDataSource dataSource = new SQLiteDataSource();
        dataSource.setUrl("jdbc:sqlite:" + databasePath);
        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").target("15").load().migrate();

        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        String now = Instant.parse("2026-09-20T00:00:00Z").toString();
        jdbc.update("""
                INSERT INTO record_entry (id, owner_id, record_date, record_type, title, content_html,
                    content_text, created_at, updated_at)
                VALUES ('record-1', 'owner-1', '2026-09-20', 'quick', '旧附件', '', '迁移测试', ?, ?)
                """, now, now);
        jdbc.update("""
                INSERT INTO record_attachment (id, record_id, original_name, stored_name, media_type,
                    size_bytes, created_at)
                VALUES ('attachment-1', 'record-1', 'legacy.txt', 'attachment-1.txt', 'text/plain', 12, ?)
                """, now);
        byte[] content = "legacy-bytes".getBytes(StandardCharsets.UTF_8);
        Path legacyFile = temporaryDirectory.resolve("records/attachments/attachment-1.txt");
        Files.createDirectories(legacyFile.getParent());
        Files.write(legacyFile, content);

        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().migrate();

        LocalDatabaseProperties properties = new LocalDatabaseProperties();
        properties.setPath(databasePath);
        FileAssetService service = new FileAssetService(
                new FileAssetRepository(jdbc), new LocalBlobStore(properties));
        byte[] migrated = service.readAllBytes("owner-1", "attachment-1", FileAssetService.DOMAIN_RECORD,
                "record-1", FileAssetService.ROLE_ATTACHMENT);

        assertArrayEquals(content, migrated);
        assertEquals(0, jdbc.queryForObject(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'record_attachment'",
                Integer.class));
    }
}
