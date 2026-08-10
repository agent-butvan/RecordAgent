# ButvanAgent AgentScope 原生权限系统重构与接入教程

## 1. 这份文档解决什么问题

在当前 `ButvanAgent` 项目的 `server-agents` 模块中，权限系统存在自行重复封装与 AgentScope 2.0 原生权限体系不兼容的问题：
1. **类定义重复**：自定义了 `butvan.agent.agents.security.PermissionMode` 和 `PermissionRule`，与 AgentScope 官方核心类同名且冲突。
2. **规则匹配逻辑交错**：`PermissionChecker` 手工编写正则表达式进行硬判定，而 `AgentSecurity` 又在尝试将其转化为 AgentScope `PermissionContextState`，导致匹配规则双重生效且易遗漏内置工具（如 `execute`）。
3. **模式无法原生效能**：未直接利用 AgentScope 原生的 `PermissionMode`（`BYPASS` / `ACCEPT_EDITS` / `DONT_ASK` / `EXPLORE` / `DEFAULT`）全局兜底策略，导致在开启权限上下文时，未显式允许的工具被误降级为人机确认（`ASK`）从而挂起推流。
4. **缺失人机协同（HITL）闭环**：当框架产生 `ASK` 人机确认要求（`RequireUserConfirmEvent`）时，后端 SSE 无法捕获并推送到前端界面进行交互。

**重构核心原则**：
1. **完全对齐 AgentScope Java 2.0 原生 Core**：全面废弃自定义权限枚举与规则对象，直接继承与整合 `io.agentscope.core.permission.*`。
2. **职责分离与三层防御（Layered Defense）**：
   - **Layer 0（模式兜底）**：由 AgentScope 原生 `PermissionMode` 控制全局默认放行/限制基线。
   - **Layer 1（硬拦截 Hard Deny）**：由 `AgentSecurity` 直接针对高危 Shell/系统命令（如 `rm -rf /`）注册全局强制拒绝规则。
   - **Layer 2（用户动态配置）**：由 `PermissionChecker` 负责读取 `~/.butvan-agent/permissions.yaml` 文件的动态规则。
3. **支持 HITL 人机交互**：将 AgentScope 拦截到的 `ASK` 事件转换为 SSE 事件推送至前端。

本教程将手把手指导你如何结合当前项目代码，一步一步将权限系统优雅地重构成符合 AgentScope 官方标准的架构。

---

## 2. 核心原理与架构设计

重构后的权限系统由 AgentScope 的 `PermissionContextState` 统一托管，通过 `AgentSecurity` 组装 Factory 结合用户配置，直接注入到 `HarnessAgent`：

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       AgentScope 原生权限架构三层防御                        │
├──────────┼────────────────────────────┼─────────────────────────────────────┤
│ 防御层级 │ 核心载体 / 机制            │ 核心职责                            │
├──────────┼────────────────────────────┼─────────────────────────────────────┤
│ Layer 0  │ PermissionMode (模式兜底)  │ BYPASS(放行)/ACCEPT_EDITS/EXPLORE(只读)│
│ Layer 1  │ AgentSecurity (高危硬拦截) │ 针对 execute/Bash 等硬注入 rm -rf 防线│
│ Layer 2  │ PermissionChecker (用户YAML)│ 读取 ~/.butvan-agent/permissions.yaml│
└──────────┴────────────────────────────┴─────────────────────────────────────┤
```

**工作流**：
```text
用户请求 / 配置文件 (PermissionMode & YAML)
    ↓
PermissionChecker 读取并解析 YAML 为 List<io.agentscope.core.permission.PermissionRule>
    ↓
AgentSecurity 组装原生的 PermissionContextState (设置 mode, 注册 Layer 1 & Layer 2 规则)
    ↓
传递给 HarnessAgent.builder().permissionContext(permissionContext).build()
    ↓
AgentScope 引擎执行工具时动态判定:
 ├── ALLOW ──> 直接执行工具
 ├── DENY  ──> 返回拒绝消息给模型
 └── ASK   ──> 抛出 RequireUserConfirmEvent ──> 转为 AgentStreamEvent.RequireConfirm ──> 推送 SSE 到前端
```

---

## 3. 包结构与目录规划

在后端 `agent-backend/server-agents` 模块的 `src/main/java/butvan/agent/agents/security/` 路径下整理权限包结构：

```text
butvan.agent.agents.security/
├── PermissionChecker.java      // [修改] 专注于 YAML 权限配置文件的解析与读取
├── AgentSecurity.java          // [重构] AgentScope 原生 PermissionContextState 组装工厂
└── [删除] PermissionMode.java  // [删除] 废弃重复的自定义枚举，直接使用 AgentScope 原生类
```

---

## 4. 第一步：废弃项目自定义 `PermissionMode.java`

### 1.1 说明干什么的

在原代码中，`butvan.agent.agents.security.PermissionMode` 是项目自行定义的枚举，只有 `DEFAULT`、`RESTRICTED`、`BYPASS` 三种选项。这与 AgentScope 原生的 `io.agentscope.core.permission.PermissionMode` 冲突，导致 AgentScope 引擎无法识别并生效原生策略。

删除此文件后，项目将直接引入 AgentScope 官方的 `PermissionMode`。

### 1.2 操作指南

直接删除该文件：
- **删除文件**：[PermissionMode.java](file:///Users/butvan/Butvan_Projets/my_code/ButvanAgent/agent-backend/server-agents/src/main/java/butvan/agent/agents/security/PermissionMode.java)

---

## 5. 第二步：改造 `PermissionChecker.java`

### 2.1 说明干什么的

修改 `PermissionChecker.java`，移除原先手写正则表达式盲目判定的逻辑，将其职责精简与聚焦为：
1. 管理当前运行的 AgentScope 原生 `PermissionMode`。
2. 负责读取与解析本地 `~/.butvan-agent/permissions.yaml` 配置文件，将其直接转换为 AgentScope 官方的 `PermissionRule` 对象列表。

### 2.2 完整代码实现

在 `agent-backend/server-agents/src/main/java/butvan/agent/agents/security/PermissionChecker.java` 中替换为以下完整代码：

```java
package butvan.agent.agents.security;

import io.agentscope.core.permission.PermissionBehavior;
import io.agentscope.core.permission.PermissionMode;
import io.agentscope.core.permission.PermissionRule;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.yaml.snakeyaml.Yaml;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 权限配置读取器与管理器。
 * <p>
 * 负责维护当前权限模式（{@link PermissionMode}），
 * 并从用户本地配置路径（{@code ~/.butvan-agent/permissions.yaml}）装载自定义权限规则列表，
 * 供 {@link AgentSecurity} 转化为 AgentScope 原生 {@link io.agentscope.core.permission.PermissionContextState}。
 */
@Slf4j
public class PermissionChecker {

    /** 当前系统的运行权限模式 */
    @Getter
    private PermissionMode mode;

    /** 当前项目根路径 */
    private final Path projectRoot;

    /** 从 YAML 解析装载的 AgentScope 原生权限规则列表 */
    @Getter
    private final List<PermissionRule> fileRules;

    /**
     * 构造权限配置检查器。
     *
     * @param mode        初始运行权限模式（若为 null 则默认为 AgentScope DEFAULT 模式）
     * @param projectRoot 当前项目根路径
     */
    public PermissionChecker(PermissionMode mode, Path projectRoot) {
        this.mode = mode != null ? mode : PermissionMode.DEFAULT;
        this.projectRoot = projectRoot != null
                ? projectRoot.toAbsolutePath().normalize()
                : Paths.get(".").toAbsolutePath().normalize();
        this.fileRules = new ArrayList<>(loadRules());
    }

    /**
     * 动态更新运行权限模式。
     *
     * @param mode 新的权限模式
     */
    public void setMode(PermissionMode mode) {
        this.mode = mode != null ? mode : PermissionMode.DEFAULT;
    }

    /**
     * 从本地用户配置路径装载三层 YAML 权限规则。
     *
     * @return 解析完成的 PermissionRule 规则列表
     */
    private List<PermissionRule> loadRules() {
        List<PermissionRule> rules = new ArrayList<>();

        // 默认用户配置文件路径: ~/.butvan-agent/permissions.yaml
        Path userConfigPath = Paths.get(System.getProperty("user.home"), ".butvan-agent", "permissions.yaml");

        if (Files.exists(userConfigPath)) {
            log.info("[PermissionChecker] 检测到本地权限配置文件: {}", userConfigPath);
            rules.addAll(parseYamlRules(userConfigPath));
        } else {
            log.debug("[PermissionChecker] 未检测到本地权限配置文件，将使用默认内置规则。");
        }

        return rules;
    }

    /**
     * 解析 YAML 文件并转换为 AgentScope 原生 PermissionRule。
     *
     * @param yamlPath YAML 文件绝对路径
     * @return 解析出的 PermissionRule 列表
     */
    @SuppressWarnings("unchecked")
    private List<PermissionRule> parseYamlRules(Path yamlPath) {
        List<PermissionRule> rules = new ArrayList<>();
        try (InputStream in = Files.newInputStream(yamlPath)) {
            Yaml yaml = new Yaml();
            Map<String, Object> data = yaml.load(in);

            if (data != null && data.containsKey("rules")) {
                List<Map<String, Object>> ruleList = (List<Map<String, Object>>) data.get("rules");
                for (Map<String, Object> map : ruleList) {
                    String toolName = (String) map.getOrDefault("tool", "*");
                    String pattern = (String) map.getOrDefault("pattern", ".*");
                    String action = (String) map.getOrDefault("action", "ALLOW");

                    PermissionBehavior behavior = switch (action.toUpperCase()) {
                        case "DENY" -> PermissionBehavior.DENY;
                        case "ASK" -> PermissionBehavior.ASK;
                        default -> PermissionBehavior.ALLOW;
                    };

                    // 直接构造 AgentScope 原生 PermissionRule
                    rules.add(new PermissionRule(toolName, pattern, behavior, "Layer2-YamlUserRule"));
                }
            }
        } catch (Exception e) {
            log.error("[PermissionChecker] 解析 YAML 权限文件失败: {}", yamlPath, e);
        }
        return rules;
    }
}
```

---

## 6. 第三步：重构 `AgentSecurity.java`

### 3.1 说明干什么的

重构 `AgentSecurity.java`，让其扮演 **AgentScope PermissionContext 工厂** 的角色：
1. 调用 `PermissionContextState.builder().mode(checker.getMode())` 将全局模式直接绑定给 AgentScope 引擎。
2. 当模式为 `BYPASS` 时，注册全量通配放行规则（`*`），防止未匹配规则的工具误触发 `ASK` 人机确认导致对话悬挂。
3. 注入 Layer 1 高危硬拦截防线（如针对内置 Shell 工具 `execute` 和 `Bash` 拦截 `rm -rf`）。
4. 将 `PermissionChecker` 读出的 YAML 用户规则按 `DENY`、`ALLOW`、`ASK` 分别注入 `builder.addDenyRule()`、`addAllowRule()`、`addAskRule()`。

### 3.2 完整代码实现

在 `agent-backend/server-agents/src/main/java/butvan/agent/agents/security/AgentSecurity.java` 中替换为以下完整代码：

```java
package butvan.agent.agents.security;

import io.agentscope.core.permission.PermissionBehavior;
import io.agentscope.core.permission.PermissionContextState;
import io.agentscope.core.permission.PermissionMode;
import io.agentscope.core.permission.PermissionRule;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 智能体安全与 AgentScope PermissionContext 适配中心。
 * <p>
 * 负责将 {@link PermissionChecker} 加载的三层规则与安全模式，
 * 组装为 AgentScope 原生 {@link PermissionContextState} 并注入 HarnessAgent。
 */
@Slf4j
@Component
public class AgentSecurity {

    /**
     * 构建并返回集成了模式兜底、Layer 1 硬拦截与 Layer 2 用户规则的 AgentScope 原生 PermissionContextState。
     *
     * @param checker 权限检查与配置加载器
     * @return 组装完毕的 PermissionContextState 实例
     */
    public PermissionContextState createPermissionContext(PermissionChecker checker) {
        PermissionContextState.Builder builder = PermissionContextState.builder();

        if (checker == null) {
            return builder.mode(PermissionMode.DEFAULT).build();
        }

        // 1. 设置全局模式基线 (BYPASS / ACCEPT_EDITS / EXPLORE / DONT_ASK / DEFAULT)
        builder.mode(checker.getMode());

        // 2. 当处于 BYPASS 模式时，注册全局通配 Allow 规则，保障所有合法工具调用不被误拦截
        if (checker.getMode() == PermissionMode.BYPASS) {
            builder.addAllowRule("*", new PermissionRule(
                    "*", ".*", PermissionBehavior.ALLOW, "Layer0-BypassMode"
            ));
            return builder.build();
        }

        // 3. Layer 1：注册高危命令硬拦截规则 (针对框架内置的 execute 与 Bash 工具)
        PermissionRule hardDenyExecute = new PermissionRule(
                "execute", "rm\\s+-[a-z]*r[a-z]*f.*", PermissionBehavior.DENY, "Layer1-DangerousHardDeny"
        );
        PermissionRule hardDenyBash = new PermissionRule(
                "Bash", "rm\\s+-[a-z]*r[a-z]*f.*", PermissionBehavior.DENY, "Layer1-DangerousHardDeny"
        );

        builder.addDenyRule("execute", hardDenyExecute);
        builder.addDenyRule("Bash", hardDenyBash);

        // 4. Layer 2：注入由 YAML 配置文件解析出的用户动态规则
        List<PermissionRule> rules = checker.getFileRules();
        for (PermissionRule rule : rules) {
            if (rule.behavior() == PermissionBehavior.DENY) {
                builder.addDenyRule(rule.toolName(), rule);
                log.info("[AgentSecurity] 成功向 AgentScope 注入 Deny 规则: {}({})", rule.toolName(), rule.pattern());
            } else if (rule.behavior() == PermissionBehavior.ALLOW) {
                builder.addAllowRule(rule.toolName(), rule);
                log.info("[AgentSecurity] 成功向 AgentScope 注入 Allow 规则: {}({})", rule.toolName(), rule.pattern());
            } else if (rule.behavior() == PermissionBehavior.ASK) {
                builder.addAskRule(rule.toolName(), rule);
                log.info("[AgentSecurity] 成功向 AgentScope 注入 Ask 规则: {}({})", rule.toolName(), rule.pattern());
            }
        }

        return builder.build();
    }
}
```

---

## 7. 第四步：在 `AgentService.java` 中接入权限构建器

### 4.1 说明干什么的

修改 `AgentService.java`：
1. 引入 AgentScope 原生 `PermissionMode`。
2. 正确实例化 `PermissionChecker`。
3. 在 `createHarnessAgent` 方法中通过 `.permissionContext(agentSecurity.createPermissionContext(permissionChecker))` 完美绑定权限上下文。

### 4.2 完整代码实现

在 `agent-backend/server-agents/src/main/java/butvan/agent/agents/agent/AgentService.java` 中更新对应代码段：

```java
package butvan.agent.agents.agent;

import butvan.agent.agents.prompt.PromptBuilder;
import butvan.agent.agents.security.AgentSecurity;
import butvan.agent.agents.security.PermissionChecker;
import io.agentscope.core.permission.PermissionMode; // 引入 AgentScope 原生 PermissionMode
import io.agentscope.harness.agent.HarnessAgent;
import io.agentscope.harness.agent.memory.compaction.CompactionConfig;
import io.agentscope.core.model.Model;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.file.Paths;

/**
 * Agent 核心调度服务。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentService {

    private final ModelHolder modelHolder;
    private final ToolRegistry toolRegistry;
    private final AgentSecurity agentSecurity;

    /** 权限检查与配置管理器 (默认开启 BYPASS 模式进行开发测试) */
    private final PermissionChecker permissionChecker = new PermissionChecker(
            PermissionMode.BYPASS,
            Paths.get(".").toAbsolutePath().normalize()
    );

    /**
     * 创建当前模型对应的 HarnessAgent 实例。
     *
     * @param model 当前激活的大模型
     * @return HarnessAgent 实例
     */
    private HarnessAgent createHarnessAgent(Model model) {
        String modelName = model.getModelName() != null ? model.getModelName() : "unknown-model";
        String workDir = System.getProperty("user.dir");
        String sysPrompt = PromptBuilder.buildDefaultSystemPrompt(modelName, workDir);

        return HarnessAgent.builder()
                .name("butvan_agent")
                .sysPrompt(sysPrompt)
                .model(model)
                .toolkit(toolRegistry.getToolkit())
                // 绑定重构后的 AgentScope 原生权限上下文
                .permissionContext(agentSecurity.createPermissionContext(permissionChecker))
                .workspace(Paths.get(".agentscope/workspace"))
                .compaction(CompactionConfig.builder()
                        .triggerMessages(30)
                        .keepMessages(10)
                        .build())
                .build();
    }
}
```

---

## 8. 第五步：在 `AgentStreamEvent.java` 中扩充人机协同（HITL）事件支持

### 5.1 说明干什么的

当 AgentScope 在非 BYPASS 模式下命中了 `ASK` 规则时，引擎会产生 `RequireUserConfirmEvent`。
通过在 `AgentStreamEvent` 中扩展 `RequireConfirm` 事件记录，并更新 `mapEvent` 方法，可以将二次确认请求无缝转换为 SSE 事件推送给前端界面。

### 5.2 代码修改实现

1. 修改 `AgentStreamEvent.java` 增加记录：

```java
package butvan.agent.agents.agent;

import java.util.Map;

/**
 * Agent 对话流标准事件接口。
 */
public sealed interface AgentStreamEvent permits
        AgentStreamEvent.Completed,
        AgentStreamEvent.Failed,
        AgentStreamEvent.TextDelta,
        AgentStreamEvent.ToolCall,
        AgentStreamEvent.ToolResult,
        AgentStreamEvent.RequireConfirm {

    String eventName();
    Object payload();

    default boolean isTerminal() {
        return false;
    }

    // ... 其他事件记录保留 ...

    /**
     * 工具调用二次确认 (HITL) 事件。
     *
     * @param toolName 工具名称
     * @param reason   需要确认的原因或指令内容
     */
    record RequireConfirm(String toolName, String reason) implements AgentStreamEvent {
        @Override
        public String eventName() {
            return "confirm_required";
        }

        @Override
        public Object payload() {
            return Map.of("tool", toolName, "reason", reason != null ? reason : "");
        }
    }
}
```

2. 在 `AgentService.java` 的 `mapEvent` 方法中补充映射：

```java
private AgentStreamEvent mapEvent(AgentEvent event) {
    if (event instanceof TextBlockDeltaEvent textEvent) {
        return new AgentStreamEvent.TextDelta(textEvent.getDelta());
    }
    if (event instanceof AgentEndEvent) {
        return new AgentStreamEvent.Completed();
    }
    if (event instanceof ToolCallStartEvent toolCallStartEvent) {
        return new AgentStreamEvent.ToolCall(toolCallStartEvent.getToolCallName());
    }
    if (event instanceof ToolResultTextDeltaEvent toolResultTextDeltaEvent) {
        return new AgentStreamEvent.ToolResult(toolResultTextDeltaEvent.getDelta());
    }
    // 捕获 AgentScope 的人机确认请求事件并转换为 SSE 事件
    if (event instanceof io.agentscope.core.event.RequireUserConfirmEvent confirmEvent) {
        return new AgentStreamEvent.RequireConfirm(confirmEvent.getToolName(), confirmEvent.getCommand());
    }

    return null;
}
```

---

## 9. 建议的实施顺序与验证方式

| 次序 | 修改内容 | 对应文件路径 | 成功验证标志 |
| --- | --- | --- | --- |
| 1 | 删除重复枚举 | `security/PermissionMode.java` | 文件完全清理。 |
| 2 | 重构规则解析器 | `security/PermissionChecker.java` | 能够读取 `~/.butvan-agent/permissions.yaml` 并转为 AgentScope `PermissionRule`。 |
| 3 | 重构原生工厂 | `security/AgentSecurity.java` | `createPermissionContext` 成功根据 `PermissionMode` 和规则注入 `PermissionContextState`。 |
| 4 | 绑定 AgentService | `agent/AgentService.java` | 启动项目无报错，发送`检查一下我的电脑最近电池的情况`时，`execute` 工具流畅调起并吐出响应。 |
| 5 | 支持 HITL 事件 | `agent/AgentStreamEvent.java` | 命中 `ASK` 规则时后端控制台与 SSE 流收到 `confirm_required` 事件。 |

---

## 10. 最终代码职责表

| 类名 | 归属包 | 职责与作用 |
| --- | --- | --- |
| `PermissionChecker` | `security` | 维护运行 `PermissionMode` 并解析用户本地 `permissions.yaml` 配置文件。 |
| `AgentSecurity` | `security` | 适配工厂：将模式与规则转换为 AgentScope 原生 `PermissionContextState`。 |
| `AgentService` | `agent` | 将组装好的 `PermissionContextState` 传入 `HarnessAgent` 并处理流式事件。 |
| `AgentStreamEvent` | `agent` | 封装文本增量、工具调用以及人机确认（HITL）事件并向网络层推流。 |
