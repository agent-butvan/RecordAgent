package butvan.agent.agents.session;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.agents.session.dto.CreateSessionRequest;
import butvan.agent.agents.session.dto.SessionKind;
import butvan.agent.agents.session.dto.SessionStatus;
import butvan.agent.agents.session.dto.SessionSummaryDto;
import butvan.agent.agents.storage.AgentStorageProperties;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * 应用会话目录册服务。
 *
 * <p>只管理产品需要的会话摘要；不接触 AgentScope 工作区和内部 session 文件。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SessionCatalogService {

    private final AgentStorageProperties agentStorageProperties;

    private final CurrentUserProvider currentUserProvider;

    private final ObjectMapper objectMapper;

    /**
     * 创建会话
     * @param request
     * @return
     */
    public synchronized SessionSummaryDto create(CreateSessionRequest request) {
        SessionKind kind = request != null && request.kind() != null ? request.kind() : SessionKind.GENERAL;
        if (kind == SessionKind.PROJECT) {
            throw new IllegalArgumentException("项目会话需要先完成项目目录册功能，当前仅支持 GENERAL");
        }

        Instant now = Instant.now();
        SessionSummaryDto created = new SessionSummaryDto(
                UUID.randomUUID().toString(),
                kind,
                normalizeTitle(request == null ? null : request.title(), "新对话"),
                "",
                now,
                now,
                SessionStatus.ACTIVE
        );

        List<CatalogRecord> records = readRecords();
        records.add(CatalogRecord.from(currentUserProvider.currentUserId(), created));
        writeRecords(records);

        return created;
    }

    /** 返回当前用户所有未删除会话，按最近更新时间倒序。 */
    public synchronized List<SessionSummaryDto> listActive() {
        String ownerId = currentUserProvider.currentUserId();
        return readRecords().stream()
                .filter(record -> ownerId.equals(record.ownerId()))
                .filter(record -> record.status() == SessionStatus.ACTIVE)
                .map(CatalogRecord::toDto)
                .sorted(Comparator.comparing(SessionSummaryDto::updatedAt).reversed())
                .toList();
    }

    /** 校验会话存在、归属正确且可继续使用；聊天、详情、改标题都会复用它。 */
    public synchronized SessionSummaryDto requireActive(String sessionId) {
        String ownerId = currentUserProvider.currentUserId();
        return readRecords().stream()
                .filter(record -> ownerId.equals(record.ownerId()))
                .filter(record -> record.id().equals(sessionId))
                .map(CatalogRecord::toDto)
                .filter(dto -> dto.status() == SessionStatus.ACTIVE)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("会话不存在、无权访问或正在删除"));
    }

    /** 只修改标题，其他受保护字段保持不变。 */
    public synchronized SessionSummaryDto updateTitle(String sessionId, String title) {
        List<CatalogRecord> records = readRecords();
        String ownerId = currentUserProvider.currentUserId();

        for (int index = 0; index < records.size(); index++) {
            CatalogRecord record = records.get(index);
            if (ownerId.equals(record.ownerId()) && record.id().equals(sessionId)
                    && record.status() == SessionStatus.ACTIVE) {
                CatalogRecord updated = record.withTitle(normalizeTitle(title, record.title()));
                records.set(index, updated);
                writeRecords(records);
                return updated.toDto();
            }
        }
        throw new IllegalArgumentException("会话不存在、无权访问或正在删除");
    }

    /** 完成一轮对话后更新摘要排序和侧边栏预览。 */
    public synchronized void touch(String sessionId, String assistantContent) {
        List<CatalogRecord> records = readRecords();
        String ownerId = currentUserProvider.currentUserId();

        for (int index = 0; index < records.size(); index++) {
            CatalogRecord record = records.get(index);
            if (ownerId.equals(record.ownerId()) && record.id().equals(sessionId)
                    && record.status() == SessionStatus.ACTIVE) {
                records.set(index, record.withPreview(toPreview(assistantContent)));
                writeRecords(records);
                return;
            }
        }
    }

    /** 将会话置为删除中，阻止后续新的聊天请求进入。 */
    public synchronized void markDeleting(String sessionId) {
        List<CatalogRecord> records = readRecords();
        String ownerId = currentUserProvider.currentUserId();
        boolean updated = false;

        for (int index = 0; index < records.size(); index++) {
            CatalogRecord record = records.get(index);
            if (ownerId.equals(record.ownerId()) && record.id().equals(sessionId)) {
                records.set(index, record.withStatus(SessionStatus.DELETING));
                updated = true;
                break;
            }
        }
        if (!updated) {
            throw new IllegalArgumentException("会话不存在或无权删除");
        }
        writeRecords(records);
    }

    /** 清理完成后真正移除目录册条目。 */
    public synchronized void remove(String sessionId) {
        String ownerId = currentUserProvider.currentUserId();
        List<CatalogRecord> remaining = readRecords().stream()
                .filter(record -> !(ownerId.equals(record.ownerId()) && record.id().equals(sessionId)))
                .toList();
        writeRecords(remaining);
    }

    private void writeRecords(List<CatalogRecord> records) {
        Path catalogFile = agentStorageProperties.getSessionCatalogFile();
        Path temporaryFile = catalogFile.resolveSibling(catalogFile.getFileName() + ".tmp");
        try {
            // 先写临时文件，再替换正式文件，避免进程中断留下半个 JSON 文件
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(temporaryFile.toFile(), records);
            Files.move(temporaryFile, catalogFile,
                    StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new IllegalArgumentException("会话目录册写入失败", e);
        }
    }

    private List<CatalogRecord> readRecords() {
        Path catalogFile = agentStorageProperties.getSessionCatalogFile();
        if (!Files.exists(catalogFile)) {
            return new ArrayList<>();
        }
        try {
            return new ArrayList<>(objectMapper.readValue(catalogFile.toFile(), new TypeReference<>() { }));
        } catch (IOException e) {
            // 目录册损坏时不能默默覆盖，线报错，保护用户已有数据
            throw new IllegalArgumentException("会话目录册读取失败，请先备份后修复：" + catalogFile, e);
        }
    }

    private String normalizeTitle(String rawTitle, String defaultTitle) {
        if (rawTitle == null || rawTitle.isBlank()) {
            return defaultTitle;
        }
        // 标题是产品文案，不允许无限长或换行。
        String oneLine = rawTitle.strip().replaceAll("[\\r\\n]+", " ");
        return oneLine.substring(0, Math.min(80, oneLine.length()));
    }

    private String toPreview(String content) {
        if (content == null || content.isBlank()) {
            return "";
        }
        String oneLine = content.strip().replaceAll("[\\r\\n]+", " ");
        return oneLine.substring(0, Math.min(100, oneLine.length()));
    }

    /**
     * 写入磁盘的内部结构
     * @param id
     * @param ownerId
     * @param kind
     * @param title
     * @param lastMessagePreview
     * @param createAt
     * @param updateAt
     * @param status
     */
    private record CatalogRecord(
            String id,
            String ownerId,
            SessionKind kind,
            String title,
            String lastMessagePreview,
            Instant createAt,
            Instant updateAt,
            SessionStatus status
    ) {

        static CatalogRecord from(String ownerId, SessionSummaryDto dto) {
            return new CatalogRecord(dto.id(), ownerId, dto.kind(), dto.title(), dto.lastMessagePreview(), dto.createdAt(), dto.updatedAt(), dto.status());
        }

        CatalogRecord withTitle(String newTitle) {
            return new CatalogRecord(id, ownerId, kind, newTitle, lastMessagePreview, createAt, updateAt, status);
        }

        CatalogRecord withPreview(String preview) {
            return new CatalogRecord(id, ownerId, kind, title, preview, createAt, updateAt, status);
        }

        CatalogRecord withStatus(SessionStatus newStatus) {
            return new CatalogRecord(id, ownerId, kind, title, lastMessagePreview, createAt, updateAt, newStatus);
        }

        SessionSummaryDto toDto() {
            return new SessionSummaryDto(id, kind, title, lastMessagePreview, createAt, updateAt, status);
        }
    }
}
