package butvan.agent.network.file.storage;

import butvan.agent.network.config.database.LocalDatabaseProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/** 使用应用数据目录保存二进制对象，并通过临时文件与原子移动避免暴露半份内容。 */
@Component
@RequiredArgsConstructor
public class LocalBlobStore implements BlobStore {
    private static final int BUFFER_SIZE = 16 * 1024;
    private static final String OBJECT_PREFIX = "files/objects/";
    private static final String LEGACY_PREFIX = "records/attachments/";

    private final LocalDatabaseProperties databaseProperties;

    @Override
    public StoredBlob put(String objectId, InputStream content, long maximumBytes) {
        requireObjectId(objectId);
        if (content == null) throw new IllegalArgumentException("文件内容不能为空");
        if (maximumBytes < 1) throw new IllegalArgumentException("文件大小上限必须大于零");

        String storageKey = OBJECT_PREFIX + objectId.substring(0, 2) + "/" + objectId.substring(2, 4) + "/" + objectId;
        Path target = resolve(storageKey);
        Path stagingDirectory = dataRoot().resolve("files/staging");
        Path temporary = null;
        try {
            Files.createDirectories(target.getParent());
            Files.createDirectories(stagingDirectory);
            temporary = Files.createTempFile(stagingDirectory, ".upload-", ".tmp");
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long size = copy(content, temporary, maximumBytes, digest);
            moveAtomically(temporary, target);
            temporary = null;
            return new StoredBlob(storageKey, size, HexFormat.of().formatHex(digest.digest()));
        } catch (IOException exception) {
            throw new IllegalStateException("本地文件写入失败", exception);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("当前运行环境不支持 SHA-256", exception);
        } finally {
            deleteTemporary(temporary);
        }
    }

    @Override
    public InputStream open(String storageKey) {
        Path target = resolve(storageKey);
        if (Files.isSymbolicLink(target) || !Files.isRegularFile(target)) {
            throw new IllegalArgumentException("文件内容不存在");
        }
        try {
            return Files.newInputStream(target);
        } catch (IOException exception) {
            throw new IllegalStateException("本地文件读取失败", exception);
        }
    }

    @Override
    public void delete(String storageKey) {
        Path target = resolve(storageKey);
        if (Files.isSymbolicLink(target)) throw new IllegalArgumentException("文件对象不能是符号链接");
        try {
            Files.deleteIfExists(target);
        } catch (IOException exception) {
            throw new IllegalStateException("本地文件删除失败", exception);
        }
    }

    private long copy(InputStream source, Path target, long maximumBytes, MessageDigest digest) throws IOException {
        long total = 0;
        byte[] buffer = new byte[BUFFER_SIZE];
        try (OutputStream output = Files.newOutputStream(target)) {
            int read;
            while ((read = source.read(buffer)) != -1) {
                total += read;
                if (total > maximumBytes) throw new IllegalArgumentException("文件超过允许的大小上限");
                output.write(buffer, 0, read);
                digest.update(buffer, 0, read);
            }
        }
        return total;
    }

    private Path resolve(String storageKey) {
        if (storageKey == null
                || (!storageKey.startsWith(OBJECT_PREFIX) && !storageKey.startsWith(LEGACY_PREFIX))) {
            throw new IllegalArgumentException("本地文件存储键非法");
        }
        Path root = dataRoot();
        Path resolved = root.resolve(storageKey).normalize();
        Path allowedRoot = storageKey.startsWith(OBJECT_PREFIX)
                ? root.resolve("files/objects")
                : root.resolve("records/attachments");
        if (!resolved.startsWith(allowedRoot)) throw new IllegalArgumentException("本地文件存储键越界");
        return resolved;
    }

    private Path dataRoot() {
        Path databasePath = databaseProperties.getPath().toAbsolutePath().normalize();
        Path parent = databasePath.getParent();
        if (parent == null) throw new IllegalStateException("SQLite 数据库路径必须包含父目录");
        return parent;
    }

    private void requireObjectId(String objectId) {
        if (objectId == null || !objectId.matches("[a-f0-9]{32}")) {
            throw new IllegalArgumentException("文件对象 ID 格式非法");
        }
    }

    private void moveAtomically(Path source, Path target) throws IOException {
        try {
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException exception) {
            Files.move(source, target);
        }
    }

    private void deleteTemporary(Path temporary) {
        if (temporary == null) return;
        try {
            Files.deleteIfExists(temporary);
        } catch (IOException ignored) {
            // 主异常已包含写入失败原因；残留 staging 文件可由后续清理任务回收。
        }
    }
}
