package butvan.agent.network.service.account;

import butvan.agent.network.file.model.FileAsset;
import butvan.agent.network.file.repository.FileAssetRepository;
import butvan.agent.network.file.service.FileAssetService;
import butvan.agent.network.file.storage.LocalBlobStore;
import butvan.agent.network.config.database.LocalDatabaseProperties;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.sqlite.SQLiteDataSource;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** 验证头像的真实格式、尺寸限制以及账户文件绑定。 */
class AccountAvatarServiceTest {
    @TempDir
    private Path temporaryDirectory;
    private FileAssetService files;
    private AccountAvatarService service;

    @BeforeEach
    void setUp() {
        LocalDatabaseProperties properties = new LocalDatabaseProperties();
        properties.setPath(temporaryDirectory.resolve("butvan.db"));
        SQLiteDataSource dataSource = new SQLiteDataSource();
        dataSource.setUrl("jdbc:sqlite:" + properties.getPath());
        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().migrate();
        files = new FileAssetService(new FileAssetRepository(new JdbcTemplate(dataSource)),
                new LocalBlobStore(properties));
        service = new AccountAvatarService(files);
    }

    @Test
    void storesValidatedPngAsAccountAvatar() throws Exception {
        FileAsset result = service.replace("owner-1", new MockMultipartFile(
                "file", "portrait.jpg", "image/jpeg", png(96, 96)));

        assertEquals("portrait.png", result.originalName());
        assertEquals("image/png", result.mediaType());
        assertEquals(result.id(), service.current("owner-1").id());
    }

    @Test
    void rejectsNonImageAndUndersizedImage() throws Exception {
        assertThrows(IllegalArgumentException.class, () -> service.replace("owner-1",
                new MockMultipartFile("file", "avatar.png", "image/png", "not-an-image".getBytes())));
        assertThrows(IllegalArgumentException.class, () -> service.replace("owner-1",
                new MockMultipartFile("file", "avatar.png", "image/png", png(32, 32))));
    }

    private byte[] png(int width, int height) throws Exception {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            ImageIO.write(image, "png", output);
            return output.toByteArray();
        }
    }
}
