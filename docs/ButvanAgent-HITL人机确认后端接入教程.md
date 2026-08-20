# ButvanAgent HITL 人机确认后端接入教程

## 1. 目标与边界

本教程为 ButvanAgent 接入 AgentScope Java 2.0 的 Permission HITL（Human-in-the-Loop，人机确认）能力。完成后，Agent 在调用高风险工具前会暂停，将操作交给前端逐条展示；用户确认后，后端恢复原来的 Agent 推理。

本次已经确定的产品策略如下：

| 项目 | 决定 |
| --- | --- |
| 默认确认范围 | 文件写入/编辑、Shell 命令、网络请求 |
| 低风险工具 | 读取文件、Glob、Grep 等只读工具自动放行 |
| 多工具调用 | 前端逐条审核，后端收集完整批次结果后一次恢复 Agent |
| “记住选择”范围 | 仅当前用户的当前会话；不写入 `permissions.yaml`，应用重启或会话结束即失效 |
| 记忆粒度 | 精确到“工具名 + 完整输入参数”，不把一次确认扩大为同类操作全放行 |

> **为什么不直接接受 AgentScope 的 suggested rules？**
>
> 当前项目使用 AgentScope `2.0.0`。`RequireUserConfirmEvent` 提供的是 `ToolUseBlock`，而该版本的 `ToolUseBlock` 并没有公开的 `getSuggestedRules()`。更重要的是，建议规则的匹配语义由各工具的 `matchRule()` 决定，手工拼接规则容易把一次授权扩大为整类命令授权。本教程因此使用应用侧、精确参数指纹的会话记忆；恢复时仍通过原生 `ConfirmResult` 放行本次调用。

---

## 2. 先理解完整链路

当前 `AgentService` 的 SSE 请求是单向的：`/agent/chat/stream` 发起 Agent，SSE 输出文本和工具事件后关闭。HITL 需要在中间增加一次“暂停 → 用户提交决定 → 新 SSE 恢复”的往返：

```text
POST /agent/chat/stream
    │
    ▼
AgentScope 发现高风险工具，发出 RequireUserConfirmEvent
    │
    ▼
SSE: permission_required（携带 approvalId 与第一个待确认工具）
    │                         ← 这条 SSE 在此结束，不保存 assistant 最终消息
    ▼
前端逐条展示；每一条调用 POST /agent/chat/permission/decision
    │
    ▼
后端把各条决定临时保存；全部决定完成后返回 readyToResume=true
    │
    ▼
POST /agent/chat/permission/resume（新的 SSE）
    │
    ▼
后端把 List<ConfirmResult> 放进 Msg.METADATA_CONFIRM_RESULTS
    │
    ▼
AgentScope 执行已允许工具、向模型反馈已拒绝工具，继续输出文本/工具事件
```

这里的关键是：**不能重新发送原来的用户问题**。AgentScope 已经把处于 `ASKING` 状态的 `ToolUseBlock` 和对话上下文保存在 `AgentStateStore` 中；恢复时只能发送携带 `ConfirmResult` 的“恢复消息”。

---

## 3. 实施顺序与文件规划

请严格按下列顺序编写。后续步骤只引用前面已经创建的类型。

```text
server-agents/src/main/java/butvan/agent/agents/
├── agent/
│   ├── AgentRun.java                       # 一次未完成对话的运行态
│   ├── PendingApproval.java                # 一批待确认工具与用户决定
│   ├── PendingApprovalStore.java           # 内存暂存与会话授权记忆
│   ├── PermissionDecisionRequest.java      # 前端提交单条决定的 DTO
│   ├── PermissionDecisionResponse.java     # 返回下一条/可恢复状态的 DTO
│   └── AgentStreamEvent.java                # 新增 permission_required SSE 事件
├── security/
│   └── AgentSecurity.java                  # DEFAULT + 只读 allow + 高风险 ask

server-network/src/main/java/butvan/agent/network/controller/
└── AgentController.java                    # decision 与 resume 两个接口
```

本教程只新增后端代码；前端随后只需消费 `permission_required`、逐条提交 `decision`，最后连接 `resume` SSE。

---

## 4. 第一步：确认 Harness 内置工具并停止使用 BYPASS

### 4.1 保持自定义工具为注释状态

当前 `ToolRegistry` 中的自定义工具注册保持注释，**不要取消注释**。`HarnessAgent.builder()` 会在构建阶段自动注册官方文件系统工具；当底层文件系统为 Sandbox 时，还会注册官方 Shell 工具。这个选择能直接获得 Harness 的路径规范化、工作区隔离及官方权限检查。

本教程以 AgentScope Harness 2.0.0 的官方工具名为准：

| 类别 | 官方工具名 | 权限策略 |
| --- | --- | --- |
| 只读文件工具 | `read_file`、`grep_files`、`glob_files`、`list_files` | `ALLOW` |
| 文件修改 | `write_file`、`edit_file` | `ASK` |
| Shell | `execute`（仅 Sandbox 场景自动提供） | `ASK` |
| 网络/MCP | 以实际注册工具名为准 | `ASK` |

因此，`ToolRegistry` 仅保留为将来接入外部 MCP 或真正缺失能力时的扩展点；不要再为内置文件/Shell 能力注册同名自定义实现。

### 4.2 停止使用 BYPASS

把 `AgentService` 中的权限模式从 `BYPASS` 改为 `DEFAULT`：

```java
// DEFAULT：未被明确允许的调用会进入 ASK，而不是被 BYPASS 自动放行。
private final PermissionChecker permissionChecker = new PermissionChecker(
        PermissionMode.DEFAULT,
        Paths.get(".").toAbsolutePath().normalize()
);
```

同时删除 `AgentSecurity#createPermissionContext` 中“BYPASS 时添加 `*` allow rule 并 return”的分支。该分支会让高风险工具绕过你的业务确认策略。

---

## 5. 第二步：配置“只读放行，高风险确认”规则

这里是**整体替换方法体**，不是在某一行后追加。以你当前文件为准：替换 `AgentSecurity.java` 第 **28–75 行**（从 `public PermissionContextState createPermissionContext...` 到它对应的 `}`）；第 78–88 行已有的 `addAllow` 和 `addAsk` 两个辅助方法保持不动。

替换后，原来第 39–46 行的 BYPASS 分支、第 48–57 行的自定义 `Bash` deny 规则都会被删除；原来第 59–72 行的 YAML 注入循环保留在新方法末尾。完整替换内容如下：

```java
public PermissionContextState createPermissionContext(PermissionChecker checker) {
    PermissionContextState.Builder builder = PermissionContextState.builder()
            .mode(checker == null ? PermissionMode.DEFAULT : checker.getMode());

    // 只读工具明确放行，避免每次代码浏览都打断用户。
    addAllow(builder, "read_file");
    addAllow(builder, "grep_files");
    addAllow(builder, "glob_files");
    addAllow(builder, "list_files");

    // 高风险工具明确要求确认。规则内容为 null，表示该工具的所有调用都匹配。
    addAsk(builder, "write_file");
    addAsk(builder, "edit_file");
    addAsk(builder, "execute");

    // 暂无网络/MCP 工具时不要写虚构名称。将来接入后，改为实际注册的工具名。

    // 保留原有 YAML 规则：用户显式 DENY / ALLOW / ASK 仍覆盖默认策略。
    if (checker != null) {
        for (PermissionRule rule : checker.getFileRules()) {
            if (rule.behavior() == PermissionBehavior.DENY) {
                builder.addDenyRule(rule.toolName(), rule);
            } else if (rule.behavior() == PermissionBehavior.ALLOW) {
                builder.addAllowRule(rule.toolName(), rule);
            } else if (rule.behavior() == PermissionBehavior.ASK) {
                builder.addAskRule(rule.toolName(), rule);
            }
        }
    }
    return builder.build();
}

/** 为避免重复样板，统一添加工具级放行规则。 */
private void addAllow(PermissionContextState.Builder builder, String toolName) {
    builder.addAllowRule(toolName, new PermissionRule(
            toolName, null, PermissionBehavior.ALLOW, "builtInReadOnly"));
}

/** 为高风险工具添加工具级 ASK 规则。 */
private void addAsk(PermissionContextState.Builder builder, String toolName) {
    builder.addAskRule(toolName, new PermissionRule(
            toolName, null, PermissionBehavior.ASK, "builtInHighRisk"));
}
```

原先硬编码的 `Bash` deny 规则与自定义工具绑定，应移除；`execute` 规则则须先在集成测试中验证 `ruleContent` 的匹配语义后再启用。不要假定正则表达式一定会被官方工具按预期解释。

> Harness 内置文件系统与 Shell 工具的危险路径、Sandbox 和权限检查仍然是底线；本教程的 `ASK` 只负责把高风险操作交给用户确认，不能替代框架内置防护。

---

## 6. 第三步：创建确认 DTO 与运行态对象

先在 `butvan.agent.agents.agent` 包创建以下四个文件。

### 6.1 `PermissionDecisionRequest.java`

```java
package butvan.agent.agents.agent;

/** 前端对单个待确认工具提交的决定。 */
public record PermissionDecisionRequest(
        String sessionId,
        String approvalId,
        String toolCallId,
        boolean approved,
        boolean rememberForSession
) {}
```

### 6.2 `PermissionDecisionResponse.java`

```java
package butvan.agent.agents.agent;

/** 单条决定保存后的结果；前端据此展示下一条或开始恢复流。 */
public record PermissionDecisionResponse(
        boolean readyToResume,
        PermissionToolDto nextTool
) {
    /** 返回一个尚未处理的下一条工具。 */
    public static PermissionDecisionResponse next(PermissionToolDto tool) {
        return new PermissionDecisionResponse(false, tool);
    }

    /** 本批工具已逐条决定完毕，可以调用 resume 接口。 */
    public static PermissionDecisionResponse ready() {
        return new PermissionDecisionResponse(true, null);
    }
}
```

### 6.3 `PermissionToolDto.java`

不要把 `ToolUseBlock` 直接暴露到 REST/SSE。该对象是 AgentScope 内部模型，前端只需要安全的展示字段。

```java
package butvan.agent.agents.agent;

import io.agentscope.core.message.ToolUseBlock;
import java.util.Map;

/** 发给前端的单条待确认工具说明。 */
public record PermissionToolDto(
        String toolCallId,
        String toolName,
        Map<String, Object> input,
        String riskDescription,
        int index,
        int total
) {
    /** 将框架工具调用转换为前端 DTO，不泄露内部 metadata。 */
    public static PermissionToolDto from(ToolUseBlock tool, int index, int total) {
        return new PermissionToolDto(
                tool.getId(), tool.getName(), tool.getInput(),
                riskDescriptionOf(tool.getName()), index, total
        );
    }

    private static String riskDescriptionOf(String toolName) {
        return switch (toolName) {
            case "write_file", "edit_file" -> "将修改本地文件内容";
            case "execute" -> "将在本机 Shell 中执行命令";
            case "http_request" -> "将向外部网络发送请求";
            default -> "该工具属于需要确认的高风险操作";
        };
    }
}
```

### 6.4 `AgentRun.java`

`AgentRun` 只保存“等待确认期间”继续执行所需的业务状态。AgentScope 自己的上下文仍由 `AgentStateStore` 持久化；这里不复制或序列化其内部状态。

```java
package butvan.agent.agents.agent;

import io.agentscope.core.agent.RuntimeContext;
import butvan.agent.agents.session.dto.TranscriptMessageDto;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** 一次尚未完成的用户回合；只在服务进程内短暂存活。 */
public final class AgentRun {
    private final String sessionId;
    private final String userId;
    private final String turnId;
    private final RuntimeContext runtimeContext;
    private final Instant startedAt;
    private final StringBuilder content = new StringBuilder();
    private final StringBuilder thinking = new StringBuilder();
    // 初始 SSE 与恢复 SSE 共用同一份工具参数和执行记录。
    private final Map<String, StringBuilder> toolArgsBuffer = new ConcurrentHashMap<>();
    private final Map<String, TranscriptMessageDto.ToolExecutionDto> toolExecutions =
            new LinkedHashMap<>();

    public AgentRun(String sessionId, String userId, String turnId, RuntimeContext runtimeContext) {
        this.sessionId = sessionId;
        this.userId = userId;
        this.turnId = turnId;
        this.runtimeContext = runtimeContext;
        this.startedAt = Instant.now();
    }

    // 下面 getter 仅暴露恢复和最终落库需要的数据。
    public String sessionId() { return sessionId; }
    public String userId() { return userId; }
    public String turnId() { return turnId; }
    public RuntimeContext runtimeContext() { return runtimeContext; }
    public Instant startedAt() { return startedAt; }
    public StringBuilder content() { return content; }
    public StringBuilder thinking() { return thinking; }
    public Map<String, StringBuilder> toolArgsBuffer() { return toolArgsBuffer; }
    public Map<String, TranscriptMessageDto.ToolExecutionDto> toolExecutions() {
        return toolExecutions;
    }
}
```

---

## 7. 第四步：实现逐条确认与会话记忆仓库

创建 `PendingApproval.java`。它保存一批 AgentScope 暂停的工具调用，并按原始顺序返回下一条未决定项目。

```java
package butvan.agent.agents.agent;

import io.agentscope.core.event.ConfirmResult;
import io.agentscope.core.message.ToolUseBlock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** 一次 Permission ASK 产生的一批待审核工具。 */
public final class PendingApproval {
    private final String approvalId = UUID.randomUUID().toString();
    private final AgentRun run;
    private final List<ToolUseBlock> tools;
    private final Map<String, Decision> decisions = new LinkedHashMap<>();
    private final Instant expiresAt = Instant.now().plusSeconds(600);

    public PendingApproval(AgentRun run, List<ToolUseBlock> tools) {
        this.run = run;
        this.tools = List.copyOf(tools);
    }

    public String approvalId() { return approvalId; }
    public AgentRun run() { return run; }
    public boolean expired() { return Instant.now().isAfter(expiresAt); }

    /** 只接受当前批次中尚未决定的工具，防止重复提交或篡改 callId。 */
    public synchronized void decide(String toolCallId, boolean approved) {
        boolean exists = tools.stream().anyMatch(tool -> tool.getId().equals(toolCallId));
        if (!exists || decisions.containsKey(toolCallId)) {
            throw new IllegalArgumentException("待确认工具不存在或已经处理");
        }
        decisions.put(toolCallId, new Decision(approved));
    }

    public synchronized PermissionToolDto nextTool() {
        for (int i = 0; i < tools.size(); i++) {
            ToolUseBlock tool = tools.get(i);
            if (!decisions.containsKey(tool.getId())) {
                return PermissionToolDto.from(tool, i + 1, tools.size());
            }
        }
        return null;
    }

    public synchronized boolean allDecided() {
        return decisions.size() == tools.size();
    }

    /** 只有全部决定后才构造恢复 AgentScope 的 ConfirmResult 列表。 */
    public synchronized List<ConfirmResult> toConfirmResults() {
        if (!allDecided()) {
            throw new IllegalStateException("仍有工具尚未确认");
        }
        return tools.stream()
                .map(tool -> new ConfirmResult(decisions.get(tool.getId()).approved(), tool))
                .toList();
    }

    private record Decision(boolean approved) {}
}
```

接着创建 `PendingApprovalStore.java`。会话记忆使用“工具名 + 排序后的完整参数 JSON”的 SHA-256 指纹，既不持久化，也不使用宽泛 allow rule。

```java
package butvan.agent.agents.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import io.agentscope.core.message.ToolUseBlock;
import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** 管理未完成审批及“仅当前会话”的精确授权记忆。 */
@Component
public class PendingApprovalStore {
    private final Map<String, PendingApproval> approvals = new ConcurrentHashMap<>();
    private final Map<String, Boolean> sessionDecisions = new ConcurrentHashMap<>();
    private final ObjectMapper canonicalJson = new ObjectMapper()
            .configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true);

    public void save(PendingApproval approval) {
        approvals.put(approval.approvalId(), approval);
    }

    /** 同时校验 approvalId、用户和会话，不能只相信前端传来的 UUID。 */
    public PendingApproval require(String approvalId, String userId, String sessionId) {
        PendingApproval approval = Optional.ofNullable(approvals.get(approvalId))
                .orElseThrow(() -> new IllegalArgumentException("确认请求不存在或已失效"));
        if (approval.expired()) {
            approvals.remove(approvalId);
            throw new IllegalArgumentException("确认请求已超时，请重新发起任务");
        }
        AgentRun run = approval.run();
        if (!run.userId().equals(userId) || !run.sessionId().equals(sessionId)) {
            throw new IllegalArgumentException("无权操作此确认请求");
        }
        return approval;
    }

    public void remember(String userId, String sessionId, ToolUseBlock tool, boolean approved) {
        sessionDecisions.put(key(userId, sessionId, tool), approved);
    }

    public Optional<Boolean> remembered(String userId, String sessionId, ToolUseBlock tool) {
        return Optional.ofNullable(sessionDecisions.get(key(userId, sessionId, tool)));
    }

    public void remove(String approvalId) {
        approvals.remove(approvalId);
    }

    /** 会话被删除或用户显式清空会话时必须调用，避免内存长期累积。 */
    public void clearSession(String userId, String sessionId) {
        String prefix = userId + ":" + sessionId + ":";
        sessionDecisions.keySet().removeIf(key -> key.startsWith(prefix));
    }

    private String key(String userId, String sessionId, ToolUseBlock tool) {
        try {
            String json = canonicalJson.writeValueAsString(tool.getInput());
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest((tool.getName() + "\n" + json).getBytes(StandardCharsets.UTF_8));
            return userId + ":" + sessionId + ":" + java.util.HexFormat.of().formatHex(digest);
        } catch (Exception exception) {
            throw new IllegalStateException("无法生成工具授权指纹", exception);
        }
    }
}
```

---

## 8. 第五步：扩展 SSE 事件模型

在 `AgentStreamEvent` 的 `permits` 列表加入 `PermissionRequired`，然后新增记录类：

```java
record PermissionRequired(String approvalId, PermissionToolDto firstTool)
        implements AgentStreamEvent {

    @Override
    public String eventName() {
        return "permission_required";
    }

    @Override
    public Object payload() {
        return Map.of("approvalId", approvalId, "tool", firstTool);
    }

    /** 结束当前 SSE；恢复会由前端建立新的 SSE 连接。 */
    @Override
    public boolean isTerminal() {
        return true;
    }
}
```

这不是错误事件。前端收到它时应将该 assistant 消息标记为“等待你的确认”，而不是显示失败。

---

## 9. 第六步：在 `AgentService` 暂停并恢复

先在现有 `AgentService` 的依赖字段中加入仓库。类已经标有 `@RequiredArgsConstructor`，因此不需要手写构造器：

```java
// 保存等待用户确认的批次，以及当前会话的精确授权记忆。
private final PendingApprovalStore pendingApprovalStore;
```

### 9.1 提取共用的运行方法

这一节不需要你自己“提取循环”。请按下面三个明确动作修改：

1. 保证你已经完成第 6 节的 `AgentRun`、第 7 节的 `PendingApprovalStore`；否则先不要进入本节。
2. 在当前 [AgentService.java](/Users/butvan/Butvan_Projets/my_code/ButvanAgent/agent-backend/server-agents/src/main/java/butvan/agent/agents/agent/AgentService.java:88) 中，**整体替换第 88–177 行的 `produceEvents(...)` 方法**。不要修改第 80–85 行的 `streamAgent(...)`。
3. 将本节后面的三个小方法和一个 `runAgentStream(...)` 方法，依次粘贴到 `produceEvents(...)` 方法结束后的下一行、`collectToolExecution(...)` 方法之前。

`produceEvents(...)` 替换后的完整代码如下。它的职责只剩“创建本轮 `AgentRun` 并启动流”；文本、工具记录和完成状态都交给后面的 `runAgentStream(...)` 统一处理：

```java
private void produceEvents(AgentUserCall request, AgentStreamSession streamSession) {
    AgentRun run = null;
    try {
        if (request == null) {
            throw new IllegalArgumentException("聊天请求不能为空");
        }
        if (!modelHolder.isInitialized()) {
            putEvent(streamSession, new AgentStreamEvent.Failed("请先完成模型配置。"));
            return;
        }

        // 1. 防止客户端伪造或使用已删除的会话。
        sessionCatalogService.requireActive(request.sessionId());
        String input = requireContent(request.context());

        // 2. 用户消息只在初始请求时保存一次；恢复确认时不能再次保存它。
        String turnId = transcriptService.appendUserMessage(request.sessionId(), input);
        String userId = currentUserProvider.currentUserId();
        RuntimeContext context = createRuntimeContext(request.sessionId());
        run = new AgentRun(request.sessionId(), userId, turnId, context);

        // 3. 初始调用将用户消息交给 AgentScope；后续恢复会传入确认消息。
        runAgentStream(run, List.of(new UserMessage(input)), streamSession);
    } catch (Exception exception) {
        if (streamSession.isCancelled() || Thread.currentThread().isInterrupted()) {
            Thread.currentThread().interrupt();
            if (run != null) {
                finishCancelledRun(run);
            }
            return;
        }

        String sessionId = request == null ? null : request.sessionId();
        log.error("Agent 流处理失败: sessionId={}", sessionId, exception);
        if (run != null) {
            finishAssistantMessage(run.sessionId(), run.turnId(), run.content(), run.thinking(),
                    TranscriptMessageDto.MessageStatus.FAILED,
                    run.startedAt(), run.toolExecutions());
        }
        putEvent(streamSession, new AgentStreamEvent.Failed(
                exception instanceof IllegalArgumentException
                        ? exception.getMessage() : "Agent 处理失败，请稍后重试。"));
    }
}
```

紧接着，在该方法之后粘贴以下三个小方法，把原来局部变量上的累计逻辑迁移到 `AgentRun`：

```java
private void appendAndCollect(AgentRun run, AgentStreamEvent event) {
    if (event instanceof AgentStreamEvent.TextDelta text) {
        run.content().append(text.content());
    } else if (event instanceof AgentStreamEvent.ThinkingDelta thinking) {
        run.thinking().append(thinking.content());
    }
    collectToolExecution(event, run.toolExecutions());
}

private void finishCompletedRun(AgentRun run) {
    finishAssistantMessage(run.sessionId(), run.turnId(), run.content(), run.thinking(),
            TranscriptMessageDto.MessageStatus.COMPLETED,
            run.startedAt(), run.toolExecutions());
}

private void finishCancelledRun(AgentRun run) {
    finishAssistantMessage(run.sessionId(), run.turnId(), run.content(), run.thinking(),
            TranscriptMessageDto.MessageStatus.CANCELLED,
            run.startedAt(), run.toolExecutions());
}
```

然后替换原来的主循环：

```java
private void runAgentStream(
        AgentRun run,
        List<Msg> inputMessages,
        AgentStreamSession streamSession
) {
    HarnessAgent agent = currentAgent();

    for (AgentEvent event : agent.streamEvents(inputMessages, run.runtimeContext()).toIterable()) {
        if (streamSession.isCancelled()) {
            finishCancelledRun(run);
            return;
        }

        // 必须在普通 mapEvent 之前识别该事件，不能把它当作未知事件忽略。
        if (event instanceof RequireUserConfirmEvent confirmEvent) {
            if (pauseForConfirmation(run, confirmEvent.getToolCalls(), streamSession)) {
                return; // 不调用 finishAssistantMessage；本回合尚未结束。
            }
            continue;
        }

        AgentStreamEvent mapped = mapEvent(event, run.toolArgsBuffer());
        appendAndCollect(run, mapped); // 复用原有正文/thinking/工具记录累计逻辑。
        if (mapped != null && !putEvent(streamSession, mapped)) {
            finishCancelledRun(run);
            return;
        }
        if (mapped != null && mapped.isTerminal()) {
            finishCompletedRun(run);
            return;
        }
    }

    // 自然结束同样视为完成，保留原项目的兜底语义。
    finishCompletedRun(run);
    putEvent(streamSession, new AgentStreamEvent.Completed());
}
```

需要补充 import：

```java
import io.agentscope.core.event.ConfirmResult;
import io.agentscope.core.event.RequireUserConfirmEvent;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.MsgRole;
```

### 9.2 暂停时先应用已记住的精确决定

把以下方法加入 `AgentService`。如果整个批次都命中当前会话的已记住决定，直接在**同一条 SSE**中恢复；否则只把仍需用户处理的工具放入 `PendingApproval`。这能让“记住本次会话”真正减少后续打断。

```java
private boolean pauseForConfirmation(
        AgentRun run,
        List<ToolUseBlock> askedTools,
        AgentStreamSession streamSession
) {
    List<ConfirmResult> rememberedResults = new ArrayList<>();
    List<ToolUseBlock> unresolved = new ArrayList<>();

    for (ToolUseBlock tool : askedTools) {
        Optional<Boolean> remembered = pendingApprovalStore.remembered(
                run.userId(), run.sessionId(), tool);
        if (remembered.isPresent()) {
            // 已记住也要走 ConfirmResult，不能跳过 AgentScope 的状态恢复流程。
            rememberedResults.add(new ConfirmResult(remembered.get(), tool));
        } else {
            unresolved.add(tool);
        }
    }

    if (unresolved.isEmpty()) {
        Msg resumeMessage = buildResumeMessage(rememberedResults);
        runAgentStream(run, List.of(resumeMessage), streamSession);
        return true;
    }

    // 已记住的结果也放入同一 PendingApproval，确保最终一次恢复包含整批工具的结果。
    PendingApproval approval = new PendingApproval(run, askedTools);
    rememberedResults.forEach(result -> approval.decide(
            result.getToolCall().getId(), result.isConfirmed()));
    pendingApprovalStore.save(approval);

    PermissionToolDto first = approval.nextTool();
    return putEvent(streamSession,
            new AgentStreamEvent.PermissionRequired(approval.approvalId(), first));
}
```

上面的代码要求把 `PendingApproval.decide` 保持为包可见或 public（本教程前文已为 public）。`AgentService` 还需要注入 `PendingApprovalStore`。

### 9.3 写入单条用户决定

添加服务方法：

```java
public PermissionDecisionResponse decidePermission(PermissionDecisionRequest request) {
    String userId = currentUserProvider.currentUserId();
    sessionCatalogService.requireActive(request.sessionId());
    PendingApproval approval = pendingApprovalStore.require(
            request.approvalId(), userId, request.sessionId());

    approval.decide(request.toolCallId(), request.approved());

    if (request.rememberForSession()) {
        ToolUseBlock tool = approval.findTool(request.toolCallId());
        // 记住的仅是这一组完全相同的参数；不写 YAML，不影响其他会话。
        pendingApprovalStore.remember(userId, request.sessionId(), tool, request.approved());
    }

    PermissionToolDto next = approval.nextTool();
    return next == null ? PermissionDecisionResponse.ready()
            : PermissionDecisionResponse.next(next);
}
```

因此请先在 `PendingApproval` 加入以下查询方法（放在 `nextTool()` 前后均可）：

```java
public ToolUseBlock findTool(String toolCallId) {
    return tools.stream()
            .filter(tool -> tool.getId().equals(toolCallId))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("待确认工具不存在"));
}
```

### 9.4 构造恢复消息并开启恢复 SSE

```java
private Msg buildResumeMessage(List<ConfirmResult> results) {
    Map<String, Object> metadata = new HashMap<>();
    metadata.put(Msg.METADATA_CONFIRM_RESULTS, results);

    // 这是框架恢复信号，不是用户的新提问。
    return Msg.builder()
            .name("user")
            .role(MsgRole.USER)
            .textContent("permission confirmation received")
            .metadata(metadata)
            .build();
}

public AgentStreamSession resumeAgent(String sessionId, String approvalId) {
    String userId = currentUserProvider.currentUserId();
    PendingApproval approval = pendingApprovalStore.require(approvalId, userId, sessionId);
    if (!approval.allDecided()) {
        throw new IllegalArgumentException("请先逐条完成所有工具确认");
    }

    AgentStreamSession streamSession = new AgentStreamSession();
    Thread producer = Thread.startVirtualThread(() -> {
        try {
            runAgentStream(approval.run(),
                    List.of(buildResumeMessage(approval.toConfirmResults())), streamSession);
        } finally {
            // 无论恢复成功还是失败，该批次都不能再次提交。
            pendingApprovalStore.remove(approvalId);
        }
    });
    streamSession.bindProducer(producer);
    return streamSession;
}
```

> `ConfirmResult(false, tool)` 不需要你手工创建“拒绝结果”。AgentScope 会把 `Permission denied by user` 写入工具结果上下文，然后继续让模型调整策略。

---

## 10. 第七步：增加 Controller 接口

在 `AgentController` 中保留已有 `/stream`，再添加一个普通 JSON 接口和一个新的 SSE 恢复接口。每个 Controller 方法都按项目规范标记 `@ApiLog`。

```java
@ApiLog("提交单条工具权限确认")
@PostMapping("/permission/decision")
public PermissionDecisionResponse decidePermission(
        @RequestBody PermissionDecisionRequest request
) {
    return agentService.decidePermission(request);
}

@ApiLog("恢复已确认的Agent对话SSE流")
@PostMapping(value = "/permission/resume", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter resumeChat(@RequestBody PermissionResumeRequest request) {
    AgentStreamSession session = agentService.resumeAgent(
            request.sessionId(), request.approvalId());
    return createEmitter(session); // 将原 streamChat 中的 emitter/发送线程逻辑提取到此方法。
}
```

新增 DTO：

```java
package butvan.agent.agents.agent;

/** 前端在本批逐条确认完成后，请求恢复 Agent。 */
public record PermissionResumeRequest(String sessionId, String approvalId) {}
```

接下来实现 `createEmitter(...)`。以你当前 `AgentController.java` 为准，按以下顺序操作：

1. 将第 34–78 行的 `streamChat(...)` **整个方法**替换为下面的短方法。
2. 将紧随其后的 `createEmitter(...)` 粘贴到 `streamChat(...)` 后、`decidePermission(...)` 前。
3. 保留你刚添加的 `resumeChat(...)`，它已经会调用该方法。

```java
@ApiLog("Agent对话SSE流式推流")
@PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter streamChat(@RequestBody AgentUserCall request) {
    // 初始对话流和确认后的恢复流共用同一套 SSE 发送/断开逻辑。
    return createEmitter(agentService.streamAgent(request));
}

/**
 * 将 Agent 事件队列转发为 HTTP SSE，并统一处理客户端断开。
 *
 * @param session 已经启动生产者的 Agent 流会话
 * @return 返回给前端的 SSE 响应
 */
private SseEmitter createEmitter(AgentStreamSession session) {
    // 0L 表示由应用控制何时关闭，避免 Spring 默认超时中断等待确认的流。
    SseEmitter emitter = new SseEmitter(0L);

    Thread sender = Thread.startVirtualThread(() -> {
        try {
            while (!Thread.currentThread().isInterrupted()) {
                // 队列为空时阻塞等待；不会占用 CPU 轮询。
                AgentStreamEvent event = session.queue().take();
                emitter.send(SseEmitter.event()
                        .name(event.eventName())
                        .data(event.payload()));

                // done、error、permission_required 都是当前 SSE 的终态事件。
                if (event.isTerminal()) {
                    return;
                }
            }
        } catch (IOException | IllegalStateException exception) {
            // 前端关闭页面或网络断开时，SseEmitter 可能抛出这些异常。
            log.debug("SSE 客户端已断开", exception);
        } catch (InterruptedException exception) {
            // onCompletion 会中断 sender；恢复中断标记以便 finally 正常释放资源。
            Thread.currentThread().interrupt();
        } finally {
            // 发送端结束后终止仍在等待模型或队列的生产者线程。
            session.cancel();
            emitter.complete();
        }
    });

    emitter.onCompletion(() -> {
        // 浏览器主动断开时，同时停止 SSE 消费线程与 Agent 生产线程。
        sender.interrupt();
        session.cancel();
    });

    return emitter;
}
```

这个方法只负责 SSE 生命周期，**不包含**权限判断。`permission_required` 只是其中一种终态事件：它发送后关闭当前连接，前端完成逐条确认后再调用 `/permission/resume` 建立下一条 SSE。

---

## 11. 第八步：补全会话清理、审计与异常语义

1. 在删除会话的服务流程中调用 `pendingApprovalStore.clearSession(userId, sessionId)`；若有该会话待确认批次，也一并删除。
2. 给 `PendingApprovalStore` 添加定时清理（例如每分钟删除过期 `approvalId`）。过期恢复应返回“确认请求已超时，请重新发起任务”，不能尝试猜测或自动放行。
3. 日志只记录 `sessionId`、`approvalId`、工具名、是否批准和参数摘要/长度；不要记录完整写入内容、令牌、HTTP Authorization 头或环境变量。
4. 初始 SSE 在 `permission_required` 后属于**正常暂停**：不要调用 `finishAssistantMessage`，不要发送 `done`。只有恢复后的最终流结束时，才写入完整 assistant 消息。
5. 同一 `approvalId + toolCallId` 重复提交返回 400；不同用户或不同会话提交返回 400/403。不要以“幂等成功”掩盖越权请求。

---

## 12. 后端验收清单

按以下顺序手工验证，每一项通过后再继续下一项：

1. 启动后确认 Harness 已提供 `read_file`；只读调用不出现确认。
2. 让模型写入一个普通工作区文件，SSE 必须先收到 `permission_required`，且文件尚未被创建。
3. 逐条拒绝，调用 `/permission/resume` 后确认工具未执行，模型能收到拒绝结果并继续或结束。
4. 逐条允许，恢复后确认工具执行一次且 assistant 消息只保存一条。
5. 同一回话对相同“工具名 + 参数”勾选“本会话记住”后再次调用，后端自动恢复，不再向前端发送确认。
6. 修改任一参数（例如不同文件路径、不同 Shell 命令）后必须再次确认。
7. 新建会话或重启后端后，相同调用必须再次确认。
8. 使用错误的 `approvalId`、错误会话或重复 `toolCallId` 提交，必须失败且不恢复 Agent。

完成以上步骤后，后端的人机确认闭环就具备了：高风险操作可见、用户逐条决定、Agent 原地恢复、会话内精确记忆，并且不会把临时授权意外持久化为全局权限。
