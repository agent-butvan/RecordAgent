package butvan.agent.agents.context;

import butvan.agent.agents.storage.AgentStorageProperties;
import butvan.agent.agents.usage.TokenCounter;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** 管理本地个人画像与自动上下文开关，并兼容旧 MEMORY.md 用户画像。 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PersonalContextService {

    public static final int MAX_PROFILE_CHARS = 12_000;
    private static final long MAX_FILE_BYTES = 1_000_000;
    private static final Pattern USER_PROFILE_SECTION = Pattern.compile(
            "(?ms)^##\\s+User Profile\\s*$\\R(.*?)(?=^##\\s+|\\z)");

    private final AgentStorageProperties storageProperties;
    private final TokenCounter tokenCounter;
    private final ObjectMapper objectMapper;

    /** 读取当前用户可见的画像；显式空文件会阻止旧画像回退。 */
    public PersonalContextProfile get(String userId) {
        Path explicitFile = storageProperties.personalContextProfileFile(userId);
        String content;
        String source;
        if (isSafeReadableFile(userId, explicitFile)) {
            content = readSmallFile(userId, explicitFile);
            source = "explicit";
        } else {
            content = extractLegacyProfile(readSmallFile(userId,
                    storageProperties.userWorkspaceDirectory(userId).resolve("MEMORY.md")));
            source = content == null || content.isBlank() ? "empty" : "legacy";
        }
        String normalized = content == null ? "" : content.strip();
        Settings settings = readSettings(userId);
        return new PersonalContextProfile(settings.enabled(), settings.maintenanceEnabled(),
                normalized, source, tokenCounter.count(normalized), revision(normalized));
    }

    /** 保存显式画像，内容在注入时仍会受独立 Token 预算裁剪。 */
    public synchronized PersonalContextProfile save(String userId, String content) {
        String normalized = content == null ? "" : content.strip();
        if (normalized.length() > MAX_PROFILE_CHARS) {
            throw new IllegalArgumentException("个人画像不能超过 " + MAX_PROFILE_CHARS + " 个字符");
        }
        writeAtomically(storageProperties.personalContextProfileFile(userId), normalized);
        return get(userId);
    }

    /** 清空自动注入画像；保留显式空文件以避免兼容来源重新出现。 */
    public synchronized PersonalContextProfile clear(String userId) {
        writeAtomically(storageProperties.personalContextProfileFile(userId), "");
        return get(userId);
    }

    /** 开启或暂停画像与相关记忆自动注入，不删除已有内容。 */
    public synchronized PersonalContextProfile setEnabled(String userId, boolean enabled) {
        Settings current = readSettings(userId);
        writeSettings(userId, new Settings(enabled, current.maintenanceEnabled()));
        return get(userId);
    }

    /** 开启或关闭“自动生成提案、用户确认后应用”的辅助维护。 */
    public synchronized PersonalContextProfile setMaintenanceEnabled(String userId, boolean enabled) {
        Settings current = readSettings(userId);
        writeSettings(userId, new Settings(current.enabled(), enabled));
        return get(userId);
    }

    private Settings readSettings(String userId) {
        String json = readSmallFile(userId, storageProperties.personalContextSettingsFile(userId));
        if (json == null || json.isBlank()) return Settings.defaults();
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode enabled = root.get("enabled");
            JsonNode maintenanceEnabled = root.get("maintenanceEnabled");
            return new Settings(
                    enabled == null || !enabled.isBoolean() || enabled.asBoolean(),
                    maintenanceEnabled != null && maintenanceEnabled.isBoolean()
                            && maintenanceEnabled.asBoolean());
        } catch (IOException exception) {
            log.warn("读取个人上下文设置失败，按启用处理：userId={}", userId, exception);
            return Settings.defaults();
        }
    }

    private void writeSettings(String userId, Settings settings) {
        try {
            writeAtomically(storageProperties.personalContextSettingsFile(userId),
                    objectMapper.writeValueAsString(Map.of(
                            "enabled", settings.enabled(),
                            "maintenanceEnabled", settings.maintenanceEnabled())));
        } catch (IOException exception) {
            throw new IllegalStateException("保存个人上下文设置失败", exception);
        }
    }

    private String revision(String content) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(content.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest, 0, 12);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("当前运行环境缺少 SHA-256", exception);
        }
    }

    private String extractLegacyProfile(String markdown) {
        if (markdown == null) return null;
        Matcher matcher = USER_PROFILE_SECTION.matcher(markdown);
        return matcher.find() ? matcher.group(1).strip() : null;
    }

    private String readSmallFile(String userId, Path path) {
        try {
            if (!isSafeReadableFile(userId, path)
                    || Files.size(path) > MAX_FILE_BYTES) return null;
            return Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            log.warn("读取个人上下文文件失败：path={}", path, exception);
            return null;
        }
    }

    private void writeAtomically(Path target, String content) {
        try {
            Path userWorkspace = target.getParent().getParent();
            if (Files.isSymbolicLink(userWorkspace) || Files.isSymbolicLink(target.getParent())) {
                throw new IllegalStateException("个人上下文目录不能是符号链接");
            }
            Files.createDirectories(target.getParent());
            if (Files.isSymbolicLink(target)) throw new IllegalStateException("个人上下文文件不能是符号链接");
            Path temporary = Files.createTempFile(target.getParent(), ".personal-context-", ".tmp");
            try {
                Files.writeString(temporary, content, StandardCharsets.UTF_8);
                try {
                    Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE,
                            StandardCopyOption.REPLACE_EXISTING);
                } catch (AtomicMoveNotSupportedException exception) {
                    Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING);
                }
            } finally {
                Files.deleteIfExists(temporary);
            }
        } catch (IOException exception) {
            throw new IllegalStateException("保存个人上下文失败", exception);
        }
    }

    private boolean isSafeReadableFile(String userId, Path path) {
        Path userWorkspace = storageProperties.userWorkspaceDirectory(userId);
        return !Files.isSymbolicLink(userWorkspace)
                && !Files.isSymbolicLink(path.getParent())
                && !Files.isSymbolicLink(path)
                && Files.isRegularFile(path);
    }

    private record Settings(boolean enabled, boolean maintenanceEnabled) {
        private static Settings defaults() {
            return new Settings(true, false);
        }
    }
}
