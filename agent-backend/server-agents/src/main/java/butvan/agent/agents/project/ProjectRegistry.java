package butvan.agent.agents.project;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.agents.storage.AgentStorageProperties;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * 本机项目引用目录册。
 *
 * <p>该深模块把路径规范化、危险根拒绝、去重、所有权与原子持久化隐藏在稳定接口后。
 * “导入”只登记目录引用，不复制、扫描、初始化或删除用户项目文件。</p>
 */
@Service
@RequiredArgsConstructor
public class ProjectRegistry {

    private final AgentStorageProperties storageProperties;
    private final CurrentUserProvider currentUserProvider;
    private final ObjectMapper objectMapper;

    /** 校验并登记一个本地目录。 */
    public synchronized ProjectSummary importProject(String rawName, String rawPath) {
        Path root = canonicalizeImportPath(rawPath);
        String ownerId = currentUserProvider.currentUserId();
        List<ProjectRecord> records = readRecords();
        records.stream()
                .filter(record -> ownerId.equals(record.ownerId()))
                .filter(record -> root.toString().equals(record.rootPath()))
                .findFirst()
                .ifPresent(record -> {
                    throw new IllegalArgumentException("该项目目录已经导入");
                });

        ProjectRecord created = new ProjectRecord(
                UUID.randomUUID().toString(),
                ownerId,
                normalizeName(rawName, root),
                root.toString(),
                Instant.now()
        );
        records.add(created);
        writeRecords(records);
        return toSummary(created);
    }

    /** 返回当前用户的项目列表，最近导入的项目在前。 */
    public synchronized List<ProjectSummary> listProjects() {
        String ownerId = currentUserProvider.currentUserId();
        return readRecords().stream()
                .filter(record -> ownerId.equals(record.ownerId()))
                .sorted(Comparator.comparing(ProjectRecord::importedAt).reversed())
                .map(this::toSummary)
                .toList();
    }

    /** 解析一个归属当前用户且目录仍可用的项目。 */
    public synchronized ProjectSummary resolve(String projectId) {
        ProjectSummary summary = get(projectId);
        if (summary.availability() != ProjectAvailability.AVAILABLE) {
            throw new IllegalArgumentException("项目目录不存在或不可访问，请重新导入该目录");
        }
        return summary;
    }

    /** 返回已登记项目；即使目录暂时离线，也允许调用方管理该引用。 */
    public synchronized ProjectSummary get(String projectId) {
        return toSummary(requireRecord(projectId));
    }

    /** 仅解除项目登记，绝不删除项目目录。 */
    public synchronized void remove(String projectId) {
        ProjectRecord target = requireRecord(projectId);
        String ownerId = currentUserProvider.currentUserId();
        List<ProjectRecord> remaining = readRecords().stream()
                .filter(record -> !(ownerId.equals(record.ownerId()) && record.id().equals(target.id())))
                .toList();
        writeRecords(remaining);
    }

    private ProjectRecord requireRecord(String projectId) {
        if (projectId == null || projectId.isBlank()) {
            throw new IllegalArgumentException("项目 ID 不能为空");
        }
        String ownerId = currentUserProvider.currentUserId();
        return readRecords().stream()
                .filter(record -> ownerId.equals(record.ownerId()))
                .filter(record -> projectId.equals(record.id()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("项目不存在或无权访问"));
    }

    private Path canonicalizeImportPath(String rawPath) {
        if (rawPath == null || rawPath.isBlank()) {
            throw new IllegalArgumentException("项目路径不能为空");
        }
        try {
            Path root = Path.of(rawPath.strip()).toRealPath();
            if (!Files.isDirectory(root) || !Files.isReadable(root)) {
                throw new IllegalArgumentException("项目目录不存在或不可读");
            }
            Path userHome = Path.of(System.getProperty("user.home")).toRealPath();
            if (root.getParent() == null || root.equals(userHome) || root.getNameCount() < 2) {
                throw new IllegalArgumentException("不能将磁盘根目录、系统目录或用户主目录导入为项目");
            }
            return root;
        } catch (IOException | InvalidPathException | SecurityException exception) {
            throw new IllegalArgumentException("项目目录不存在或不可访问");
        }
    }

    private String normalizeName(String rawName, Path root) {
        String fallback = root.getFileName() == null ? "未命名项目" : root.getFileName().toString();
        String value = rawName == null || rawName.isBlank() ? fallback : rawName.strip();
        value = value.replaceAll("[\\r\\n]+", " ");
        return value.substring(0, Math.min(80, value.length()));
    }

    private ProjectSummary toSummary(ProjectRecord record) {
        Path root = Path.of(record.rootPath());
        ProjectAvailability availability;
        if (!Files.exists(root)) {
            availability = ProjectAvailability.MISSING;
        } else if (Files.isSymbolicLink(root) || !Files.isDirectory(root) || !Files.isReadable(root)
                || !hasStableCanonicalRoot(root)) {
            availability = ProjectAvailability.INACCESSIBLE;
        } else {
            availability = ProjectAvailability.AVAILABLE;
        }
        return new ProjectSummary(record.id(), record.name(), record.rootPath(), record.importedAt(), availability);
    }

    /** 防止导入后目录被替换为指向其他位置的符号链接。 */
    private boolean hasStableCanonicalRoot(Path root) {
        try {
            return root.toAbsolutePath().normalize().equals(root.toRealPath());
        } catch (IOException | SecurityException exception) {
            return false;
        }
    }

    private List<ProjectRecord> readRecords() {
        Path catalog = storageProperties.getProjectCatalogFile();
        if (!Files.exists(catalog)) return new ArrayList<>();
        try {
            return new ArrayList<>(objectMapper.readValue(catalog.toFile(), new TypeReference<>() { }));
        } catch (IOException exception) {
            throw new IllegalArgumentException("项目目录册读取失败，请先备份后修复", exception);
        }
    }

    private void writeRecords(List<ProjectRecord> records) {
        Path catalog = storageProperties.getProjectCatalogFile();
        Path temporary = catalog.resolveSibling(catalog.getFileName() + ".tmp");
        try {
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(temporary.toFile(), records);
            Files.move(temporary, catalog, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            throw new IllegalArgumentException("项目目录册写入失败", exception);
        }
    }

    private record ProjectRecord(
            String id,
            String ownerId,
            String name,
            String rootPath,
            Instant importedAt
    ) {
    }
}
