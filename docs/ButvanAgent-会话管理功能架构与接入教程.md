# ButvanAgent 会话管理功能：后端分步接入教程

> 本教程只改后端。请严格按顺序执行：**一个步骤编译通过后，才可以进入下一步。**
>
> 本文中的代码使用项目现有的 Java 21、Spring Boot、Lombok 和 AgentScope Java 2.0。不要再直接读写 AgentScope 自动生成的 `sessions.json`、`*.jsonl`、`*.log.jsonl`。

## 1. 先理解要实现的内容

“会话管理”不是单一文件，而是四类数据的分工：

```text
用户在侧边栏看到的标题、项目归属、排序
        │
        ├── 应用会话目录册 SessionCatalog（本项目管理）
        │
用户重新打开会话时看到的聊天消息
        │
        ├── 用户可见消息记录 Transcript（本项目管理）
        │
同一会话第二次提问时，Agent 能记得前文
        │
        ├── AgentScope AgentStateStore（AgentScope 管理）
        │
技能、长期记忆、知识、AgentScope 内部运行日志
        │
        └── AgentScope Workspace（AgentScope 管理）
```

### 1.1 为什么不能直接管理 `.agentscope/workspace/.../sessions`

AgentScope 会在调用完成、异常和上下文压缩时自动更新它自己的 `sessions.json`、`<sessionId>.jsonl` 与 `<sessionId>.log.jsonl`。这些是框架运行态，不是稳定的产品数据库。

当前项目已经生成过的 `sessions.json` 只有 `summary`、`updatedAt`，并没有旧教程假设的 `title`、`projectPath` 等字段。因此：

- 不要在业务代码中给它加字段；
- 不要用它渲染产品侧边栏；
- 不要删除它来实现“删除会话”；
- 不要把该路径写死在 `SessionService`。

### 1.2 `RuntimeContext` 和会话 ID 的关系

每次调用 Agent 都会创建：

```java
RuntimeContext context = RuntimeContext.builder()
        .userId("local-default")
        .sessionId("会话 UUID")
        .build();
```

- `sessionId` 是**当前用户正在聊天的应用会话 ID**；新建会话时由后端生成新的 UUID。
- `userId` 是会话所属用户；当前桌面单用户版固定为 `local-default`，以后接登录系统时替换实现即可。
- AgentScope 使用 `(userId, sessionId)` 定位 `AgentState`。相同组合会恢复上下文；不同组合不会串话。

官方依据：[AgentScope Session](https://java.agentscope.io/v1/zh/docs/harness/session.html)、[RuntimeContext 与 AgentState](https://java.agentscope.io/v2/zh/docs/building-blocks/context.html)、[Workspace](https://java.agentscope.io/v1/zh/docs/harness/workspace.html)。

---

## 2. 最终目录与执行顺序

完成后新增或替换的后端文件如下：

```text
server-agents/src/main/java/butvan/agent/agents/
├── identity/
│   └── CurrentUserProvider.java
├── storage/
│   └── AgentStorageProperties.java
├── session/
│   ├── SessionCatalogService.java
│   ├── TranscriptService.java
│   ├── SessionLifecycleService.java
│   └── dto/
│       ├── CreateSessionRequest.java
│       ├── UpdateSessionRequest.java
│       ├── SessionKind.java
│       ├── SessionStatus.java
│       ├── SessionSummaryDto.java
│       ├── SessionDetailDto.java
│       └── TranscriptMessageDto.java
└── agent/
    ├── AgentUserCall.java
    └── AgentService.java

server-network/src/main/java/butvan/agent/network/controller/
└── SessionController.java
```

本教程先不实现项目注册 API；所以 `PROJECT` 会话先预留字段，创建时必须传 `GENERAL`。等普通会话完整跑通后，再单独接项目目录册与路径授权。

---

## 3. 第一步：集中管理本地目录

### 3.1 这一步做什么

先把所有运行态根目录集中到一个 Spring 配置类。以后修改本地数据位置，只改这一处；任何服务都不能写死 `sessionDir` 或 `~/.agentscope`。

本项目自己的数据放在 `~/.butvan-agent`，AgentScope 的状态和工作区也放在此目录下：

```text
~/.butvan-agent/
├── sessions/catalog.json
├── transcripts/<sessionId>.jsonl
└── agentscope/
    ├── state/
    └── workspace/
```

### 3.2 新建文件

创建 `agent-backend/server-agents/src/main/java/butvan/agent/agents/storage/AgentStorageProperties.java`：

```java
package butvan.agent.agents.storage;

import lombok.Getter;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * ButvanAgent 本地持久化目录的唯一入口。
 *
 * <p>所有服务都通过本类获取路径，禁止在其他类中手工拼接用户目录、
 * sessionDir 或 .agentscope 路径。</p>
 */
@Getter
@Component
public class AgentStorageProperties {

    /** ButvanAgent 的用户数据根目录，例如 /Users/xxx/.butvan-agent。 */
    private final Path rootDirectory;

    /** 保存侧边栏会话摘要的目录册文件。 */
    private final Path sessionCatalogFile;

    /** 保存用户可见消息记录的目录。 */
    private final Path transcriptDirectory;

    /** AgentScope AgentStateStore 的根目录。 */
    private final Path agentStateDirectory;

    /** AgentScope Workspace 的根目录。 */
    private final Path workspaceDirectory;

    public AgentStorageProperties() {
        // user.home 由 JVM 提供，macOS 下通常是 /Users/当前用户名。
        rootDirectory = Paths.get(System.getProperty("user.home"), ".butvan-agent");
        sessionCatalogFile = rootDirectory.resolve("sessions").resolve("catalog.json");
        transcriptDirectory = rootDirectory.resolve("transcripts");
        agentStateDirectory = rootDirectory.resolve("agentscope").resolve("state");
        workspaceDirectory = rootDirectory.resolve("agentscope").resolve("workspace");

        // 应用启动时只创建本项目明确拥有的目录；不会创建或改写 AgentScope 私有 session 文件。
        createDirectories(sessionCatalogFile.getParent());
        createDirectories(transcriptDirectory);
        createDirectories(agentStateDirectory);
        createDirectories(workspaceDirectory);
    }

    /**
     * 根据受后端控制的 UUID 得到该会话的消息文件。
     *
     * @param sessionId 会话 UUID
     * @return 用户可见消息记录文件
     */
    public Path transcriptFile(String sessionId) {
        // resolve 之前先拒绝任何路径分隔符，避免 sessionId 被用来构造越权路径。
        if (sessionId == null || !sessionId.matches("[a-zA-Z0-9-]+")) {
            throw new IllegalArgumentException("会话 ID 格式非法");
        }
        return transcriptDirectory.resolve(sessionId + ".jsonl");
    }

    private void createDirectories(Path directory) {
        try {
            Files.createDirectories(directory);
        } catch (IOException exception) {
            throw new IllegalStateException("无法初始化本地数据目录: " + directory, exception);
        }
    }
}
```

### 3.3 完成检查

执行：

```bash
cd /Users/butvan/Butvan_Projets/my_code/ButvanAgent/agent-backend
JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn -pl server-agents test
```

成功后才进行第二步。此时只是新增路径配置，尚未创建任何会话 API。

---

## 4. 第二步：提供当前用户 ID

### 4.1 这一步做什么

现在是本地单用户应用，但不能把 `"butvan"` 写死在 `AgentService`。单独抽出身份提供器后，将来改为登录用户时，不需要修改会话、消息和 Agent 调用代码。

### 4.2 新建文件

创建 `agent-backend/server-agents/src/main/java/butvan/agent/agents/identity/CurrentUserProvider.java`：

```java
package butvan.agent.agents.identity;

import org.springframework.stereotype.Component;

/**
 * 获取当前调用者的稳定身份。
 *
 * <p>当前是单机桌面版，因此返回固定本地用户。未来接入登录系统时，
 * 只替换这里为“从 Spring Security / Tauri 身份令牌读取用户 ID”即可。</p>
 */
@Component
public class CurrentUserProvider {

    /**
     * 返回当前用户 ID。
     *
     * @return 不能为 null 或空白的稳定用户 ID
     */
    public String currentUserId() {
        return "local-default";
    }
}
```

### 4.3 完成检查

再次执行第一步的 Maven 命令。成功后，项目已经具备了统一的路径入口和用户入口；仍未修改现有聊天行为。

---

## 5. 第三步：定义会话 DTO 与枚举

### 5.1 这一步做什么

先定义 Controller 会使用的数据契约。此步骤没有文件读写和 Agent 调用，所以可以单独编译确认字段正确。

> 删除旧的、不完整的 `SessionCreateRequest`、`SessionDto`、`SessionDetailDto`、`SessionTitleUpdateRequest`，避免类名和字段同时存在两套。

### 5.2 新建枚举

创建 `session/dto/SessionKind.java`：

```java
package butvan.agent.agents.session.dto;

/** 会话类型。GENERAL 是普通聊天；PROJECT 为后续项目会话预留。 */
public enum SessionKind {
    GENERAL,
    PROJECT
}
```

创建 `session/dto/SessionStatus.java`：

```java
package butvan.agent.agents.session.dto;

/** 会话生命周期状态。 */
public enum SessionStatus {
    /** 可以读取、发送消息和编辑标题。 */
    ACTIVE,
    /** 正在取消流并清理数据，拒绝新的消息请求。 */
    DELETING
}
```

### 5.3 新建请求与响应 DTO

创建 `session/dto/CreateSessionRequest.java`：

```java
package butvan.agent.agents.session.dto;

/** 创建一个空会话的请求。 */
public record CreateSessionRequest(
        SessionKind kind,
        String title
) {
}
```

创建 `session/dto/UpdateSessionRequest.java`：

```java
package butvan.agent.agents.session.dto;

/** 当前首版只允许修改标题，避免客户端修改 ownerId、状态和时间等受保护字段。 */
public record UpdateSessionRequest(String title) {
}
```

创建 `session/dto/SessionSummaryDto.java`：

```java
package butvan.agent.agents.session.dto;

import java.time.Instant;

/** 侧边栏使用的会话摘要，不包含完整消息。 */
public record SessionSummaryDto(
        String id,
        SessionKind kind,
        String title,
        String lastMessagePreview,
        Instant createdAt,
        Instant updatedAt,
        SessionStatus status
) {
}
```

创建 `session/dto/TranscriptMessageDto.java`：

```java
package butvan.agent.agents.session.dto;

import java.time.Instant;

/** 用户界面能够稳定展示的一条完整消息。 */
public record TranscriptMessageDto(
        String id,
        String turnId,
        MessageRole role,
        String content,
        Instant createdAt,
        MessageStatus status
) {
    /** 消息角色。工具详情后续可扩展为单独事件，不和普通消息混用。 */
    public enum MessageRole {
        USER,
        ASSISTANT
    }

    /** assistant 消息是否完整、失败或因客户端断开被取消。 */
    public enum MessageStatus {
        COMPLETED,
        FAILED,
        CANCELLED
    }
}
```

创建 `session/dto/SessionDetailDto.java`：

```java
package butvan.agent.agents.session.dto;

import java.util.List;

/** 点击侧边栏一条会话后，后端返回的摘要和完整消息记录。 */
public record SessionDetailDto(
        SessionSummaryDto summary,
        List<TranscriptMessageDto> messages
) {
}
```

### 5.4 完成检查

执行 Maven 编译。此时没有任何服务实现，不能提前写 Controller；下一步才实现会话目录册。

---

## 6. 第四步：实现会话目录册 `SessionCatalogService`

### 6.1 这一步做什么

本服务是会话的唯一“产品目录”。它负责创建 UUID、列出侧边栏摘要、修改标题、更新预览、标记删除。它**不读取 AgentScope JSONL，也不调用 Agent**。

### 6.2 新建文件

创建 `agent-backend/server-agents/src/main/java/butvan/agent/agents/session/SessionCatalogService.java`：

```java
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
import java.nio.charset.StandardCharsets;
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

    private final AgentStorageProperties storageProperties;
    private final CurrentUserProvider currentUserProvider;
    private final ObjectMapper objectMapper;

    /**
     * 创建会话。UUID 由后端生成，避免客户端通过时间戳伪造或碰撞 ID。
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

    private List<CatalogRecord> readRecords() {
        Path catalogFile = storageProperties.getSessionCatalogFile();
        if (!Files.exists(catalogFile)) {
            return new ArrayList<>();
        }
        try {
            return new ArrayList<>(objectMapper.readValue(catalogFile.toFile(), new TypeReference<>() { }));
        } catch (IOException exception) {
            // 目录册损坏时不能默默覆盖；先报错，保护用户已有数据。
            throw new IllegalStateException("会话目录册读取失败，请先备份后修复: " + catalogFile, exception);
        }
    }

    private void writeRecords(List<CatalogRecord> records) {
        Path catalogFile = storageProperties.getSessionCatalogFile();
        Path temporaryFile = catalogFile.resolveSibling(catalogFile.getFileName() + ".tmp");
        try {
            // 先写临时文件，再替换正式文件，避免进程中断留下半个 JSON 文件。
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(temporaryFile.toFile(), records);
            Files.move(temporaryFile, catalogFile,
                    StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            throw new IllegalStateException("会话目录册写入失败", exception);
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

    /** 写入磁盘的内部结构；ownerId 不暴露给客户端 DTO。 */
    private record CatalogRecord(
            String id,
            String ownerId,
            SessionKind kind,
            String title,
            String lastMessagePreview,
            Instant createdAt,
            Instant updatedAt,
            SessionStatus status
    ) {
        static CatalogRecord from(String ownerId, SessionSummaryDto dto) {
            return new CatalogRecord(dto.id(), ownerId, dto.kind(), dto.title(), dto.lastMessagePreview(),
                    dto.createdAt(), dto.updatedAt(), dto.status());
        }

        CatalogRecord withTitle(String newTitle) {
            return new CatalogRecord(id, ownerId, kind, newTitle, lastMessagePreview,
                    createdAt, Instant.now(), status);
        }

        CatalogRecord withPreview(String preview) {
            return new CatalogRecord(id, ownerId, kind, title, preview,
                    createdAt, Instant.now(), status);
        }

        CatalogRecord withStatus(SessionStatus newStatus) {
            return new CatalogRecord(id, ownerId, kind, title, lastMessagePreview,
                    createdAt, Instant.now(), newStatus);
        }

        SessionSummaryDto toDto() {
            return new SessionSummaryDto(id, kind, title, lastMessagePreview, createdAt, updatedAt, status);
        }
    }
}
```

### 6.3 完成检查

执行 Maven 编译。通过后，你已经可以在 Java 层创建、列出和改标题，但还没有消息记录，也没有 HTTP 接口。

---

## 7. 第五步：实现用户可见消息记录 `TranscriptService`

### 7.1 这一步做什么

消息记录服务只保存用户界面需要恢复的完整消息。它不保存每个 token 增量，也不解析 AgentScope 私有 JSONL。

### 7.2 新建文件

创建 `agent-backend/server-agents/src/main/java/butvan/agent/agents/session/TranscriptService.java`：

```java
package butvan.agent.agents.session;

import butvan.agent.agents.session.dto.TranscriptMessageDto;
import butvan.agent.agents.storage.AgentStorageProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 用户可见聊天记录服务。
 *
 * <p>每行是一条完整 JSON 消息。用户消息在 Agent 调用前写入；assistant 消息在 SSE
 * 正常结束、失败或取消时写入一次，避免逐 token 写盘带来的大量 I/O。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TranscriptService {

    private final AgentStorageProperties storageProperties;
    private final ObjectMapper objectMapper;

    /** 读取一条会话的所有完整消息；损坏单行会被跳过但记录警告。 */
    public synchronized List<TranscriptMessageDto> list(String sessionId) {
        Path transcriptFile = storageProperties.transcriptFile(sessionId);
        if (!Files.exists(transcriptFile)) {
            return List.of();
        }

        List<TranscriptMessageDto> messages = new ArrayList<>();
        try (var lines = Files.lines(transcriptFile, StandardCharsets.UTF_8)) {
            lines.filter(line -> !line.isBlank()).forEach(line -> {
                try {
                    messages.add(objectMapper.readValue(line, TranscriptMessageDto.class));
                } catch (IOException exception) {
                    // 单行损坏不应导致整个历史记录不可打开。
                    log.warn("跳过损坏的会话消息记录: sessionId={}", sessionId);
                }
            });
            return List.copyOf(messages);
        } catch (IOException exception) {
            throw new IllegalStateException("读取会话消息记录失败", exception);
        }
    }

    /** 在调用 Agent 前写入用户消息，并返回本轮 turnId。 */
    public synchronized String appendUserMessage(String sessionId, String content) {
        String turnId = UUID.randomUUID().toString();
        append(sessionId, new TranscriptMessageDto(
                UUID.randomUUID().toString(),
                turnId,
                TranscriptMessageDto.MessageRole.USER,
                content,
                Instant.now(),
                TranscriptMessageDto.MessageStatus.COMPLETED
        ));
        return turnId;
    }

    /** 在一次 Agent 流结束后写入完整 assistant 消息。 */
    public synchronized void appendAssistantMessage(
            String sessionId,
            String turnId,
            String content,
            TranscriptMessageDto.MessageStatus status
    ) {
        append(sessionId, new TranscriptMessageDto(
                UUID.randomUUID().toString(),
                turnId,
                TranscriptMessageDto.MessageRole.ASSISTANT,
                content == null ? "" : content,
                Instant.now(),
                status
        ));
    }

    /** 删除本项目拥有的用户可见记录，不影响 AgentScope 私有 workspace 日志。 */
    public synchronized void delete(String sessionId) {
        try {
            Files.deleteIfExists(storageProperties.transcriptFile(sessionId));
        } catch (IOException exception) {
            throw new IllegalStateException("删除会话消息记录失败", exception);
        }
    }

    private void append(String sessionId, TranscriptMessageDto message) {
        Path transcriptFile = storageProperties.transcriptFile(sessionId);
        try (BufferedWriter writer = Files.newBufferedWriter(
                transcriptFile,
                StandardCharsets.UTF_8,
                StandardOpenOption.CREATE,
                StandardOpenOption.WRITE,
                StandardOpenOption.APPEND
        )) {
            writer.write(objectMapper.writeValueAsString(message));
            writer.newLine();
        } catch (IOException exception) {
            throw new IllegalStateException("写入会话消息记录失败", exception);
        }
    }
}
```

### 7.3 完成检查

执行 Maven 编译。此时目录册和消息记录已经分别完成；还不能接入 Agent，因为缺少“创建、读取、删除会话”的协调服务。

---

## 8. 第六步：创建 `AgentStateStore` Bean

### 8.1 这一步做什么

在写任何依赖 AgentScope 上下文的服务前，先创建唯一的 `AgentStateStore` Bean。它保存 AgentScope 的上下文、摘要、工具状态和计划状态；应用代码只通过公开的 `AgentStateStore` API 操作，不解析其内部 JSON 文件。

### 8.2 新建文件

创建 `agent-backend/server-agents/src/main/java/butvan/agent/agents/agent/AgentRuntimeConfiguration.java`：

```java
package butvan.agent.agents.agent;

import butvan.agent.agents.storage.AgentStorageProperties;
import io.agentscope.core.state.AgentStateStore;
import io.agentscope.core.state.JsonFileAgentStateStore;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** AgentScope 运行时基础设施配置。 */
@Configuration
public class AgentRuntimeConfiguration {

    /**
     * 创建唯一状态存储。
     *
     * <p>AgentScope 会用 RuntimeContext 中的 (userId, sessionId) 在该根目录下隔离状态；
     * 因而本项目不需要也不应该自行构造 state 文件路径。</p>
     */
    @Bean(destroyMethod = "close")
    public AgentStateStore agentStateStore(AgentStorageProperties storageProperties) {
        return new JsonFileAgentStateStore(storageProperties.getAgentStateDirectory());
    }
}
```

### 8.3 完成检查

执行 Maven 编译并启动后端。此时尚未有会话 API，但 Spring 容器已经可以提供 `AgentStateStore`，下一步可以安全注入它。

---

## 9. 第七步：实现会话生命周期 `SessionLifecycleService`

### 9.1 这一步做什么

本类把目录册、消息记录、AgentState 的删除和会话详情组合起来。它不负责产生模型流；模型流在下一步才接入。

### 9.2 新建文件

创建 `agent-backend/server-agents/src/main/java/butvan/agent/agents/session/SessionLifecycleService.java`：

```java
package butvan.agent.agents.session;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.agents.session.dto.CreateSessionRequest;
import butvan.agent.agents.session.dto.SessionDetailDto;
import butvan.agent.agents.session.dto.SessionSummaryDto;
import io.agentscope.core.state.AgentStateStore;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 会话生命周期协调服务。
 *
 * <p>Controller 只调用本类；本类按固定顺序协调目录册、消息投影和 AgentScope 状态，
 * 使删除动作可理解且不污染 Controller。</p>
 */
@Service
@RequiredArgsConstructor
public class SessionLifecycleService {

    private final SessionCatalogService sessionCatalogService;
    private final TranscriptService transcriptService;
    private final CurrentUserProvider currentUserProvider;
    private final AgentStateStore agentStateStore;

    public List<SessionSummaryDto> listSessions() {
        return sessionCatalogService.listActive();
    }

    public SessionSummaryDto createSession(CreateSessionRequest request) {
        return sessionCatalogService.create(request);
    }

    public SessionDetailDto getDetail(String sessionId) {
        SessionSummaryDto summary = sessionCatalogService.requireActive(sessionId);
        return new SessionDetailDto(summary, transcriptService.list(sessionId));
    }

    public SessionSummaryDto updateTitle(String sessionId, String title) {
        return sessionCatalogService.updateTitle(sessionId, title);
    }

    /**
     * 删除顺序必须固定：先阻止新请求，再删除应用消息，随后删除 AgentState，最后移除目录册。
     */
    public void deleteSession(String sessionId) {
        sessionCatalogService.markDeleting(sessionId);
        transcriptService.delete(sessionId);

        // AgentScope 官方公开 API 负责删除该 (userId, sessionId) 的状态。
        // 不自行删除 workspace/sessions 下的框架文件。
        agentStateStore.delete(currentUserProvider.currentUserId(), sessionId);
        sessionCatalogService.remove(sessionId);
    }
}
```

### 9.3 完成检查

执行 Maven 编译并启动后端。由于上一步已经提供 `AgentStateStore` Bean，本步骤完成后可安全使用会话创建、查询、改标题和删除的服务层方法。

---

## 10. 第八步：改造聊天请求与 `AgentService`

### 10.1 这一步做什么

本步骤将前面已完成的目录册、消息投影、用户身份和 `AgentStateStore` 接入现有流式聊天服务。

> 当前项目允许用户动态切换模型。模型切换后需要新建 HarnessAgent，因此本教程采用“**每个模型实例缓存一个 Agent**”：同一模型连续聊天复用 Agent；模型变化时安全创建新的 Agent。状态不会丢失，因为状态由独立的 `AgentStateStore` 按会话 ID 保存。

### 10.2 替换 `AgentUserCall`

替换 `agent-backend/server-agents/src/main/java/butvan/agent/agents/agent/AgentUserCall.java`：

```java
package butvan.agent.agents.agent;

/**
 * 聊天流请求。
 *
 * <p>客户端只能提交 sessionId 和文本；用户身份、项目路径、权限状态必须由后端查询，
 * 不能信任客户端透传。</p>
 */
public record AgentUserCall(String sessionId, String content) {
}
```

### 10.3 完整替换 `AgentService.java`

这一步是第一次真正改变聊天流。请**完整替换** `agent-backend/server-agents/src/main/java/butvan/agent/agents/agent/AgentService.java`，不要只复制其中一部分；否则很容易遗漏字段或私有方法。

```java
package butvan.agent.agents.agent;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.agents.model.ModelHolder;
import butvan.agent.agents.prompts.PromptBuilder;
import butvan.agent.agents.security.AgentSecurity;
import butvan.agent.agents.security.PermissionChecker;
import butvan.agent.agents.session.AgentStreamSession;
import butvan.agent.agents.session.SessionCatalogService;
import butvan.agent.agents.session.TranscriptService;
import butvan.agent.agents.session.dto.TranscriptMessageDto;
import butvan.agent.agents.storage.AgentStorageProperties;
import butvan.agent.agents.tool.ToolRegistry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.event.AgentEndEvent;
import io.agentscope.core.event.AgentEvent;
import io.agentscope.core.event.TextBlockDeltaEvent;
import io.agentscope.core.event.ToolCallDeltaEvent;
import io.agentscope.core.event.ToolCallEndEvent;
import io.agentscope.core.event.ToolCallStartEvent;
import io.agentscope.core.event.ToolResultTextDeltaEvent;
import io.agentscope.core.message.UserMessage;
import io.agentscope.core.model.Model;
import io.agentscope.core.permission.PermissionMode;
import io.agentscope.core.state.AgentStateStore;
import io.agentscope.harness.agent.HarnessAgent;
import io.agentscope.harness.agent.memory.compaction.CompactionConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.file.Paths;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Agent 聊天流服务。
 *
 * <p>本类负责“应用会话 -> RuntimeContext -> AgentScope 事件流”的衔接；
 * Controller 只负责 SSE 协议，目录册和消息持久化分别交给专用服务。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentService {

    private final ModelHolder modelHolder;
    private final ToolRegistry toolRegistry;
    private final AgentSecurity agentSecurity;
    private final CurrentUserProvider currentUserProvider;
    private final SessionCatalogService sessionCatalogService;
    private final TranscriptService transcriptService;
    private final AgentStorageProperties storageProperties;
    private final AgentStateStore agentStateStore;

    /** 保留项目已有的权限策略；后续项目会话接入后应改为项目授权根目录。 */
    private final PermissionChecker permissionChecker = new PermissionChecker(
            PermissionMode.BYPASS,
            Paths.get(".").toAbsolutePath().normalize()
    );

    /** 只用于解析工具调用参数中的 command 字段。 */
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** 当前模型对应的 Agent 缓存；同一模型连续请求不会重复构建 Agent。 */
    private final AtomicReference<HarnessAgent> cachedAgent = new AtomicReference<>();

    /** 用对象引用识别 ModelHolder 是否已经切换了模型实例。 */
    private volatile Model cachedModel;

    /**
     * 创建一次 HTTP 流对应的队列和生产虚拟线程。
     *
     * <p>此方法立即返回，不能在 Controller 线程中等待模型结果。</p>
     */
    public AgentStreamSession streamAgent(AgentUserCall request) {
        AgentStreamSession streamSession = new AgentStreamSession();
        Thread producer = Thread.startVirtualThread(() -> produceEvents(request, streamSession));
        streamSession.bindProducer(producer);
        return streamSession;
    }

    /** 将 AgentScope 事件逐条转换为项目 SSE 事件，并在终态保存完整 assistant 消息。 */
    private void produceEvents(AgentUserCall request, AgentStreamSession streamSession) {
    StringBuilder assistantContent = new StringBuilder();
    String turnId = null;

    try {
        if (request == null) {
            throw new IllegalArgumentException("聊天请求不能为空");
        }
        if (!modelHolder.isInitialized()) {
            putEvent(streamSession, new AgentStreamEvent.Failed("请先完成模型配置。"));
            return;
        }

        // 1. 先校验会话属于当前用户且仍可使用，不能让客户端伪造 sessionId。
        sessionCatalogService.requireActive(request.sessionId());
        String input = requireContent(request.content());

        // 2. 先持久化用户消息。即使模型失败，用户重新打开会话仍能看到自己发送了什么。
        turnId = transcriptService.appendUserMessage(request.sessionId(), input);
        RuntimeContext context = createRuntimeContext(request.sessionId());
        Map<String, StringBuilder> toolArgsBuffer = new ConcurrentHashMap<>();

        // 3. AgentScope 按 context 中的 (userId, sessionId) 自动恢复 AgentState。
        HarnessAgent agent = currentAgent();
        for (AgentEvent event : agent.streamEvents(new UserMessage(input), context).toIterable()) {
            if (streamSession.isCancelled()) {
                // 取消时保留已输出文本，状态明确标记为 CANCELLED。
                finishAssistantMessage(request.sessionId(), turnId, assistantContent,
                        TranscriptMessageDto.MessageStatus.CANCELLED);
                return;
            }

            AgentStreamEvent mappedEvent = mapEvent(event, toolArgsBuffer);
            if (mappedEvent instanceof AgentStreamEvent.TextDelta textDelta) {
                assistantContent.append(textDelta.content());
            }
            if (mappedEvent != null && !putEvent(streamSession, mappedEvent)) {
                finishAssistantMessage(request.sessionId(), turnId, assistantContent,
                        TranscriptMessageDto.MessageStatus.CANCELLED);
                return;
            }
            if (mappedEvent != null && mappedEvent.isTerminal()) {
                finishAssistantMessage(request.sessionId(), turnId, assistantContent,
                        mappedEvent instanceof AgentStreamEvent.Failed
                                ? TranscriptMessageDto.MessageStatus.FAILED
                                : TranscriptMessageDto.MessageStatus.COMPLETED);
                return;
            }
        }

        // AgentEvent 流自然结束但未产生 AgentEndEvent 时，仍要给前端和消息记录一个完成状态。
        finishAssistantMessage(request.sessionId(), turnId, assistantContent,
                TranscriptMessageDto.MessageStatus.COMPLETED);
        putEvent(streamSession, new AgentStreamEvent.Completed());
    } catch (Exception exception) {
        if (streamSession.isCancelled() || Thread.currentThread().isInterrupted()) {
            Thread.currentThread().interrupt();
            if (turnId != null) {
                finishAssistantMessage(request.sessionId(), turnId, assistantContent,
                        TranscriptMessageDto.MessageStatus.CANCELLED);
            }
            return;
        }
        String sessionId = request == null ? null : request.sessionId();
        log.error("Agent 流处理失败: sessionId={}", sessionId, exception);
        if (turnId != null) {
            finishAssistantMessage(sessionId, turnId, assistantContent,
                    TranscriptMessageDto.MessageStatus.FAILED);
        }
        putEvent(streamSession, new AgentStreamEvent.Failed(
                exception instanceof IllegalArgumentException ? exception.getMessage() : "Agent 处理失败，请稍后重试。"
        ));
    }
}

    /** 只在此处构造 RuntimeContext，保证所有 Agent 调用都使用同一个用户身份规则。 */
private RuntimeContext createRuntimeContext(String sessionId) {
    return RuntimeContext.builder()
            .userId(currentUserProvider.currentUserId())
            .sessionId(sessionId)
            .build();
}

    /**
     * 返回与当前 ModelHolder 模型相匹配的 Agent。
     *
     * <p>模型变更时会创建新 Agent；会话状态保存在独立的 agentStateStore 中，
     * 因此不会因 Agent 实例替换而丢失。</p>
     */
private synchronized HarnessAgent currentAgent() {
    Model currentModel = modelHolder.getModel();
    HarnessAgent existingAgent = cachedAgent.get();
    if (existingAgent != null && cachedModel == currentModel) {
        return existingAgent;
    }

    // 模型切换后新建 Agent；AgentState 并不存于 Agent 实例，而是存于 agentStateStore，
    // 因此相同 sessionId 的上下文可以继续恢复。
    HarnessAgent newAgent = createHarnessAgent(currentModel);
    cachedModel = currentModel;
    cachedAgent.set(newAgent);
    return newAgent;
}

    /** 构建 Agent 时只指定根目录和状态存储，不拼接任何 sessionDir。 */
private HarnessAgent createHarnessAgent(Model model) {
    String modelName = model.getModelName() == null ? "unknown-model" : model.getModelName();
    String systemPrompt = PromptBuilder.buildDefaultSystemPrompt(
            modelName,
            System.getProperty("user.dir")
    );

    return HarnessAgent.builder()
            .name("butvan_agent")
            .sysPrompt(systemPrompt)
            .model(model)
            .toolkit(toolRegistry.getToolkit())
            .permissionContext(agentSecurity.createPermissionContext(permissionChecker))
            .workspace(storageProperties.getWorkspaceDirectory())
            .stateStore(agentStateStore)
            .compaction(CompactionConfig.builder()
                    .triggerMessages(30)
                    .keepMessages(10)
                    .build())
            .build();
}

    /** 校验用户输入，避免空消息和异常大的请求进入模型。 */
private String requireContent(String content) {
    if (content == null || content.isBlank()) {
        throw new IllegalArgumentException("消息内容不能为空");
    }
    String normalized = content.strip();
    if (normalized.length() > 20_000) {
        throw new IllegalArgumentException("消息内容不能超过 20000 个字符");
    }
    return normalized;
}

    /** 在流结束、失败或取消时仅追加一次完整 assistant 消息。 */
private void finishAssistantMessage(
        String sessionId,
        String turnId,
        StringBuilder assistantContent,
        TranscriptMessageDto.MessageStatus status
) {
    String content = assistantContent.toString();
    transcriptService.appendAssistantMessage(sessionId, turnId, content, status);
    sessionCatalogService.touch(sessionId, content);
}

    /** 将 AgentScope 原始事件翻译为前端约定的 SSE 业务事件。 */
    private AgentStreamEvent mapEvent(AgentEvent event, Map<String, StringBuilder> toolArgsBuffer) {
        if (event instanceof TextBlockDeltaEvent textEvent) {
            return new AgentStreamEvent.TextDelta(textEvent.getDelta());
        }
        if (event instanceof AgentEndEvent) {
            return new AgentStreamEvent.Completed();
        }
        if (event instanceof ToolCallDeltaEvent toolCallDeltaEvent) {
            toolArgsBuffer.computeIfAbsent(toolCallDeltaEvent.getToolCallId(), ignored -> new StringBuilder())
                    .append(toolCallDeltaEvent.getDelta() == null ? "" : toolCallDeltaEvent.getDelta());
            return null;
        }
        if (event instanceof ToolCallStartEvent toolCallStartEvent) {
            return new AgentStreamEvent.ToolCall(
                    toolCallStartEvent.getToolCallId(),
                    toolCallStartEvent.getToolCallName(),
                    ""
            );
        }
        if (event instanceof ToolCallEndEvent toolCallEndEvent) {
            String rawArguments = String.valueOf(
                    toolArgsBuffer.remove(toolCallEndEvent.getToolCallId())
            );
            return new AgentStreamEvent.ToolCall(
                    toolCallEndEvent.getToolCallId(),
                    toolCallEndEvent.getToolCallName(),
                    parseCommandFromArguments(rawArguments)
            );
        }
        if (event instanceof ToolResultTextDeltaEvent toolResultEvent) {
            return new AgentStreamEvent.ToolResult(
                    toolResultEvent.getToolCallId(),
                    toolResultEvent.getToolCallName(),
                    toolResultEvent.getDelta()
            );
        }
        // 例如 thinking 等尚未接入 UI 的事件，在这里显式忽略。
        return null;
    }

    /** 尝试从工具参数 JSON 取 command；非 JSON 参数则原样返回供 UI 展示。 */
    private String parseCommandFromArguments(String rawArguments) {
        if (rawArguments == null || rawArguments.isBlank() || "null".equals(rawArguments)) {
            return "";
        }
        try {
            JsonNode node = objectMapper.readTree(rawArguments);
            return node.has("command") ? node.get("command").asText() : rawArguments;
        } catch (Exception exception) {
            return rawArguments;
        }
    }

    /** 将业务事件放进有界队列；客户端断开触发中断时立即停止生产。 */
    private boolean putEvent(AgentStreamSession streamSession, AgentStreamEvent event) {
        try {
            streamSession.queue().put(event);
            return true;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
}
```

同时删除旧的：

```java
import io.agentscope.core.state.JsonFileAgentStateStore;

.workspace(Paths.get(".agentscope/workspace"))
.stateStore(new JsonFileAgentStateStore(
        Paths.get(System.getProperty("user.home"), ".agentscope/sessions")))
```

因为它们会把状态和工作区分散到不同且写死的路径中。

### 10.4 完成检查

执行：

```bash
cd /Users/butvan/Butvan_Projets/my_code/ButvanAgent/agent-backend
JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn -pl server-network -am test
```

通过后，聊天流已经能够：校验会话、写用户消息、使用同一 `(userId, sessionId)` 调 Agent、结束后保存完整 assistant 消息。但此时还没有会话 REST API，不能让前端使用。

---

## 11. 第九步：实现 `SessionController`

### 11.1 这一步做什么

Controller 只做 HTTP 参数和响应包装，所有业务交给 `SessionLifecycleService`。每个方法均有 `@ApiLog`，符合本项目日志规范。

### 11.2 新建文件

创建 `agent-backend/server-network/src/main/java/butvan/agent/network/controller/SessionController.java`：

```java
package butvan.agent.network.controller;

import butvan.agent.agents.session.SessionLifecycleService;
import butvan.agent.agents.session.dto.CreateSessionRequest;
import butvan.agent.agents.session.dto.SessionDetailDto;
import butvan.agent.agents.session.dto.SessionSummaryDto;
import butvan.agent.agents.session.dto.UpdateSessionRequest;
import butvan.agent.network.annotation.ApiLog;
import butvan.agent.network.common.Result;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 对外提供应用会话目录册与消息投影 API。 */
@RestController
@RequestMapping("/agent/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final SessionLifecycleService sessionLifecycleService;

    @ApiLog("获取当前用户会话列表")
    @GetMapping
    public Result<List<SessionSummaryDto>> listSessions() {
        return Result.success(sessionLifecycleService.listSessions());
    }

    @ApiLog("创建聊天会话")
    @PostMapping
    public Result<SessionSummaryDto> createSession(@RequestBody CreateSessionRequest request) {
        return Result.success(sessionLifecycleService.createSession(request));
    }

    @ApiLog("获取聊天会话详情")
    @GetMapping("/{sessionId}")
    public Result<SessionDetailDto> getSessionDetail(@PathVariable String sessionId) {
        return Result.success(sessionLifecycleService.getDetail(sessionId));
    }

    @ApiLog("修改聊天会话标题")
    @PatchMapping("/{sessionId}")
    public Result<SessionSummaryDto> updateSession(
            @PathVariable String sessionId,
            @RequestBody UpdateSessionRequest request
    ) {
        return Result.success(sessionLifecycleService.updateTitle(sessionId, request.title()));
    }

    @ApiLog("删除聊天会话")
    @DeleteMapping("/{sessionId}")
    public Result<Void> deleteSession(@PathVariable String sessionId) {
        sessionLifecycleService.deleteSession(sessionId);
        return Result.success(null);
    }
}
```

### 11.3 完成检查

再次执行：

```bash
JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn -pl server-network -am test
```

通过后启动后端，再按顺序手动验证：

```bash
# 1. 创建普通会话，保存返回的 data.id。
curl -X POST http://localhost:8081/agent/sessions \
  -H 'Content-Type: application/json' \
  -d '{"kind":"GENERAL","title":"会话测试"}'

# 2. 查询会话列表。
curl http://localhost:8081/agent/sessions

# 3. 使用第一步返回的 sessionId 调用现有 SSE 接口。
curl --no-buffer -X POST http://localhost:8081/agent/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"替换为第一步的 UUID","content":"你好"}'

# 4. 查询详情，确认用户消息和 assistant 完整消息已落盘。
curl http://localhost:8081/agent/sessions/替换为第一步的UUID
```

---

## 12. 第十步：删除旧会话代码与运行态目录

仅当第九步全部运行成功后，才做清理：

1. 删除旧空类 `agent-backend/server-agents/src/main/java/butvan/agent/agents/session/SessionService.java`；
2. 删除旧 DTO：`SessionCreateRequest`、`SessionDto`、`SessionTitleUpdateRequest`；`SessionDetailDto` 已在第三步原地替换，不要删除；
3. 将仓库中的 `agent-backend/.agentscope/` 加入 `.gitignore`，并确认其中没有要提交的用户会话；
4. 不删除 `~/.butvan-agent/`，其中是当前用户真实数据；测试前如需清空，只能由用户明确确认后手动备份与删除。

---

## 13. 最终验收清单

- [ ] 后端生成 UUID，不再使用前端 `Date.now()` 作为可信会话 ID。
- [ ] 每次聊天都通过 `RuntimeContext(userId, sessionId)` 调用 Agent。
- [ ] 同一会话第二次提问能恢复上下文，不同会话不串话。
- [ ] `catalog.json` 只保存产品摘要，`transcripts/*.jsonl` 只保存用户可见完整消息。
- [ ] AgentScope 状态位于 `~/.butvan-agent/agentscope/state`，Workspace 位于 `~/.butvan-agent/agentscope/workspace`。
- [ ] 没有业务代码读写 AgentScope 的 `sessions.json` 或 `*.log.jsonl`。
- [ ] 删除会话后，目录册条目、消息投影和 `AgentStateStore` 数据均被清理。
- [ ] API 日志不包含消息正文、API Key、AgentState、完整工具输出或项目绝对路径。
