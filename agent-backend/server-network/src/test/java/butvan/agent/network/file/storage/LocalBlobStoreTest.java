package butvan.agent.network.file.storage;

import butvan.agent.network.config.database.LocalDatabaseProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** 验证本地二进制适配器的原子写入、完整性摘要和路径隔离。 */
class LocalBlobStoreTest {
    private static final String OBJECT_ID = "0123456789abcdef0123456789abcdef";

    @TempDir
    private Path temporaryDirectory;

    @Test
    void storesAndReadsContentWithStableDigest() throws Exception {
        LocalBlobStore store = createStore();
        byte[] content = "通用文件资产".getBytes(StandardCharsets.UTF_8);

        BlobStore.StoredBlob stored = store.put(OBJECT_ID, new ByteArrayInputStream(content), 1_024);

        assertEquals(content.length, stored.sizeBytes());
        assertEquals("5aac4b82bb5a80ab8d1370af9cd1e20dcb41062c6d965e8472a3ef0c1dbec10a", stored.sha256());
        try (var input = store.open(stored.storageKey())) {
            assertArrayEquals(content, input.readAllBytes());
        }
    }

    @Test
    void rejectsOversizedContentAndRemovesStagingFile() throws Exception {
        LocalBlobStore store = createStore();

        assertThrows(IllegalArgumentException.class,
                () -> store.put(OBJECT_ID, new ByteArrayInputStream(new byte[9]), 8));

        Path staging = temporaryDirectory.resolve("files/staging");
        try (var files = Files.list(staging)) {
            assertFalse(files.findAny().isPresent());
        }
    }

    @Test
    void rejectsStorageKeysOutsideOwnedNamespaces() {
        LocalBlobStore store = createStore();

        assertThrows(IllegalArgumentException.class, () -> store.open("../../config.json"));
        assertThrows(IllegalArgumentException.class, () -> store.delete("files/objects/../../butvan.db"));
    }

    private LocalBlobStore createStore() {
        LocalDatabaseProperties properties = new LocalDatabaseProperties();
        properties.setPath(temporaryDirectory.resolve("butvan.db"));
        return new LocalBlobStore(properties);
    }
}
