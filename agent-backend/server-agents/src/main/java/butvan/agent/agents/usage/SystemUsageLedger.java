package butvan.agent.agents.usage;

import butvan.agent.agents.storage.AgentStorageProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.agentscope.core.model.ChatUsage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** 非聊天模型调用的本地追加式用量账本。 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SystemUsageLedger {

    private static final String SYSTEM_SOURCE = "system";

    private final AgentStorageProperties storageProperties;
    private final ObjectMapper objectMapper;

    /** 追加一次标题生成等系统模型调用，不将其混入聊天轮次。 */
    public synchronized SystemTokenUsageRecord append(
            String sessionId,
            UsagePurpose purpose,
            String invocationId,
            ModelIdentity modelIdentity,
            ChatUsage usage
    ) {
        UsagePurpose effectivePurpose = purpose == null ? UsagePurpose.BACKGROUND_AGENT : purpose;
        String effectiveInvocationId = invocationId == null || invocationId.isBlank()
                ? UUID.randomUUID().toString()
                : invocationId;
        SystemTokenUsageRecord record = new SystemTokenUsageRecord(
                UUID.randomUUID().toString(),
                sessionId,
                effectivePurpose,
                Instant.now(),
                ModelInvocationUsage.fromProvider(
                        effectiveInvocationId,
                        SYSTEM_SOURCE,
                        effectivePurpose,
                        modelIdentity,
                        usage
                )
        );
        Path ledgerFile = storageProperties.getSystemUsageFile();
        try {
            Files.writeString(
                    ledgerFile,
                    objectMapper.writeValueAsString(record) + System.lineSeparator(),
                    StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.WRITE,
                    StandardOpenOption.APPEND
            );
            return record;
        } catch (IOException exception) {
            throw new IllegalArgumentException("写入系统 Token 用量失败", exception);
        }
    }

    /** 读取所有有效账本记录，损坏行会被跳过并记录警告。 */
    public synchronized List<SystemTokenUsageRecord> list() {
        Path ledgerFile = storageProperties.getSystemUsageFile();
        if (!Files.exists(ledgerFile)) return List.of();
        List<SystemTokenUsageRecord> records = new ArrayList<>();
        try (var lines = Files.lines(ledgerFile, StandardCharsets.UTF_8)) {
            lines.filter(line -> !line.isBlank()).forEach(line -> {
                try {
                    records.add(objectMapper.readValue(line, SystemTokenUsageRecord.class));
                } catch (IOException exception) {
                    log.warn("跳过损坏的系统 Token 用量记录");
                }
            });
            return List.copyOf(records);
        } catch (IOException exception) {
            throw new IllegalArgumentException("读取系统 Token 用量失败", exception);
        }
    }

    /** 删除指定会话产生的系统用量；账本仍保留其他会话记录。 */
    public synchronized void deleteSession(String sessionId) {
        Path ledgerFile = storageProperties.getSystemUsageFile();
        if (!Files.exists(ledgerFile)) return;
        List<SystemTokenUsageRecord> remaining = list().stream()
                .filter(record -> !java.util.Objects.equals(record.sessionId(), sessionId))
                .toList();
        Path temporaryFile = ledgerFile.resolveSibling(ledgerFile.getFileName() + ".tmp");
        try {
            String content = remaining.stream()
                    .map(this::serialize)
                    .collect(java.util.stream.Collectors.joining(System.lineSeparator()));
            if (!content.isEmpty()) content += System.lineSeparator();
            Files.writeString(temporaryFile, content, StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            moveReplacing(temporaryFile, ledgerFile);
        } catch (IOException exception) {
            throw new IllegalArgumentException("删除会话系统 Token 用量失败", exception);
        }
    }

    private String serialize(SystemTokenUsageRecord record) {
        try {
            return objectMapper.writeValueAsString(record);
        } catch (IOException exception) {
            throw new IllegalArgumentException("序列化系统 Token 用量失败", exception);
        }
    }

    private void moveReplacing(Path source, Path target) throws IOException {
        try {
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (AtomicMoveNotSupportedException exception) {
            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }
}
