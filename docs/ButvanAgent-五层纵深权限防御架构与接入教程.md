# ButvanAgent 五层纵深权限防御架构与接入教程

## 1. 这份文档解决什么问题

在桌面智能体（`ButvanAgent`）的运行过程中，大模型具备执行 Shell 命令、修改本地文件、删除代码与调用系统工具的能力。如果缺乏严密的安全防护，Agent 可能由于错误推理或**间接 Prompt 注入攻击**（如被代码库中恶意 Markdown 诱导）执行 `rm -rf /`、删库、修改敏感配置或泄露 API Key。

**核心原则**：
1. **纵深防御 (Defense in Depth)**：叠加 5 道互补的防线，上一层拦截失败时下一层兜底，确保单个防线失效不会导致系统崩溃。
2. **硬防线与软策略结合**：危险命令与路径沙箱为**硬防线**（任何模式与白名单均无法绕过）；规则匹配与模式决策为**软策略**（可根据场景灵活调整）。
3. **闭环学习机制 (HITL)**：人在回路审批时提供“始终允许”选项，自动记录并持久化本地规则，形成越用越智能且安全基线不降低的**权限学习循环**。
4. **AgentScope 原生平滑集成**：将五层防线加载的规则真实转换为 AgentScope 原生的 `PermissionRule`，注入到 `PermissionContextState` 容器中。

本教程指导你在后端构建一套完整的五层纵深权限防御体系，并优雅地接入 AgentScope Java 的工具调度链路中。

---

## 2. 核心原理与架构设计

权限系统采用单向五层拦截流水线，只要任何一层做出明确的 `DENY` 或 `ALLOW` 决策，即刻终止后续检查并返回：

```text
               Agent 发起工具调用 (ToolCall)
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ [第 1 层] 危险命令硬拦截 (Dangerous Pattern Check)        │
│ 扫描 rm -rf /、mkfs、curl|bash 等命令 → 命中即 DENY     │
└────────────────────────────┬────────────────────────────┘
                             │ (未命中)
                             ▼
┌─────────────────────────────────────────────────────────┐
│ [第 2 层] 路径沙箱防护 (Path Sandbox)                     │
│ 校验文件绝对路径/Symlink，阻止超出项目根目录/敏感配置写入 │
└────────────────────────────┬────────────────────────────┘
                             │ (未越界)
                             ▼
┌─────────────────────────────────────────────────────────┐
│ [第 3 层] YAML 规则引擎 (Rule Engine)                    │
│ 解析 ToolName(pattern)，遵循 用户级>项目级>本地级 继承链  │
│ 铁律：DENY 跨层合并且不可覆写                             │
└────────────────────────────┬────────────────────────────┘
                             │ (未匹配)
                             ▼
┌─────────────────────────────────────────────────────────┐
│ [第 4 层] 权限模式矩阵 (Permission Mode Matrix)           │
│ 根据 default/acceptEdits/plan 模式决定 ALLOW/ASK/DENY   │
└────────────────────────────┬────────────────────────────┘
                             │ (返回 ASK)
                             ▼
┌─────────────────────────────────────────────────────────┐
│ [第 5 层] HITL 人在回路审批 (Human-in-the-Loop)         │
│ 前端弹窗询问 (y/n/a)；用户选择“始终允许”自动持久化本地规则│
└────────────────────────────┴────────────────────────────┘
```

---

## 3. 包结构与目录规划

在后端 `agent-backend/server-agents` 模块的 `src/main/java/butvan/agent/agents/` 路径下规划安全权限包：

```text
butvan.agent.agents.security/
├── PermissionMode.java          // 权限模式枚举与分类决策矩阵
├── PermissionRule.java          // YAML 规则项模型与 Glob 匹配器
├── PermissionResult.java        // 校验决策结果记录类
├── PermissionChecker.java       // 五层纵深权限检查核心引擎
└── AgentSecurity.java           // 与 AgentScope PermissionContext 的适配中心
```

---

## 4. 第一步：编写权限模式与决策矩阵 (`PermissionMode.java`)

在 `butvan.agent.agents.security` 包下创建 `PermissionMode.java`：

```java
package butvan.agent.agents.security;

/**
 * 权限控制模式枚举。
 * <p>
 * 定义智能体在不同安全场景下的整体信任等级与默认决策矩阵：
 * <ul>
 *   <li>{@link #DEFAULT}: 默认安全模式。只读工具自动放行，写操作与命令执行需要用户审批。</li>
 *   <li>{@link #ACCEPT_EDITS}: 编辑信任模式。只读与文件写入/编辑工具自动放行，仅 Shell 命令需要用户审批。</li>
 *   <li>{@link #PLAN}: 架构规划模式。仅允许安全只读与规划相关工具，写操作与命令需要审批。</li>
 *   <li>{@link #BYPASS}: 跳过审批模式。全放行（注意：第1层危险命令与第2层沙箱硬防线依然生效）。</li>
 * </ul>
 */
public enum PermissionMode {

    /** 默认安全模式：只读放行，写/命令行需确认 */
    DEFAULT,

    /** 自动接受编辑：只读/写放行，命令行需确认 */
    ACCEPT_EDITS,

    /** 规划模式：仅规划与只读放行 */
    PLAN,

    /** 完全放行模式（仅限受控 CI/CD 环境） */
    BYPASS;

    /**
     * 权限检查的三态决策输出。
     */
    public enum Decision {
        /** 放行执行 */
        ALLOW,
        /** 硬性拦截 */
        DENY,
        /** 需要人在回路 (HITL) 弹窗审批 */
        ASK
    }

    /**
     * 工具的类别划分，用于模式矩阵决策。
     */
    public enum ToolCategory {
        /** 只读类型工具（如 ReadFile, Glob, Grep） */
        READ_ONLY,
        /** 文件写入与编辑工具（如 WriteFile, EditFile） */
        WRITE_FILE,
        /** Shell/Bash 终端命令工具 */
        COMMAND
    }

    /**
     * 根据当前权限模式与工具类别，返回默认的权限决策。
     *
     * @param category 工具分类
     * @return 默认决策 (ALLOW, DENY, 或 ASK)
     */
    public Decision decide(ToolCategory category) {
        if (this == BYPASS) {
            return Decision.ALLOW;
        }

        return switch (category) {
            case READ_ONLY -> Decision.ALLOW;
            case WRITE_FILE -> (this == ACCEPT_EDITS) ? Decision.ALLOW : Decision.ASK;
            case COMMAND -> Decision.ASK;
        };
    }
}
```

---

## 5. 第二步：编写 YAML 规则项与匹配器 (`PermissionRule.java`)

在 `butvan.agent.agents.security` 包下创建 `PermissionRule.java`：

```java
package butvan.agent.agents.security;

import java.util.regex.Pattern;

/**
 * 代表一条解析后的 YAML 权限规则。
 * <p>
 * 规则语法格式为：{@code ToolName(pattern)}，例如 {@code Bash(git *)} 或 {@code ReadFile(*.env*)}。
 *
 * @param toolName 目标工具名称（如 Bash, ReadFile 等）
 * @param pattern  内容匹配通配符表达式（支持 * 与 ?）
 * @param effect   匹配成功后的处理策略（ALLOW, DENY, 或 ASK）
 */
public record PermissionRule(
        String toolName,
        String pattern,
        PermissionMode.Decision effect
) {

    /**
     * 判断当前规则是否匹配给定的工具名称与输入内容。
     *
     * @param targetToolName 正在调用的工具名称
     * @param content        提取出的工具输入参数（如 Bash 命令字符串或文件路径）
     * @return 若工具名相同且内容符合通配符模式，返回 {@code true}
     */
    public boolean matches(String targetToolName, String content) {
        if (targetToolName == null || content == null) {
            return false;
        }
        if (!this.toolName.equalsIgnoreCase(targetToolName)) {
            return false;
        }
        return globMatch(this.pattern, content);
    }

    /**
     * 将带有 * 和 ? 的 Simple Glob 表达式转换为正则表达式进行正则匹配。
     *
     * @param globPattern 通配符表达式
     * @param input       待校验的文本
     * @return 匹配成功返回 {@code true}
     */
    private static boolean globMatch(String globPattern, String input) {
        if (globPattern == null || input == null) {
            return false;
        }
        String regex = "^" + Pattern.quote(globPattern)
                .replace("*", "\\E.*\\Q")
                .replace("?", "\\E.\\Q") + "$";
        regex = regex.replace("\\Q\\E", "");

        try {
            return Pattern.compile(regex, Pattern.CASE_INSENSITIVE).matcher(input).matches();
        } catch (Exception e) {
            return input.equalsIgnoreCase(globPattern);
        }
    }
}
```

---

## 6. 第三步：编写权限结果封装类 (`PermissionResult.java`)

在 `butvan.agent.agents.security` 包下创建 `PermissionResult.java`：

```java
package butvan.agent.agents.security;

/**
 * 权限拦截校验结果封装对象。
 *
 * @param decision 校验决策（ALLOW 放行，DENY 拒绝，ASK 需用户确认）
 * @param reason   拦截或调用的具体原因说明
 */
public record PermissionResult(
        PermissionMode.Decision decision,
        String reason
) {

    /**
     * 构建无说明的放行结果。
     *
     * @return 放行 PermissionResult
     */
    public static PermissionResult allow() {
        return new PermissionResult(PermissionMode.Decision.ALLOW, "Operation allowed");
    }

    /**
     * 构建无说明的需要确认结果。
     *
     * @return 确认 PermissionResult
     */
    public static PermissionResult ask() {
        return new PermissionResult(PermissionMode.Decision.ASK, "User confirmation required");
    }

    /**
     * 构建带原因说明的需要确认结果。
     *
     * @param reason 原因描述
     * @return 确认 PermissionResult
     */
    public static PermissionResult ask(String reason) {
        return new PermissionResult(PermissionMode.Decision.ASK, reason);
    }

    /**
     * 构建带拒接原因说明的拒绝结果。
     *
     * @param reason 拒绝的防线与详细原因
     * @return 拒绝 PermissionResult
     */
    public static PermissionResult deny(String reason) {
        return new PermissionResult(PermissionMode.Decision.DENY, reason);
    }
}
```

---

## 7. 第四步：编写五层纵深权限检查核心引擎 (`PermissionChecker.java`)

在 `butvan.agent.agents.security` 包下创建 `PermissionChecker.java`，注意添加 `getFileRules()`Getter 方法以供安全适配中心注入规则：

```java
package butvan.agent.agents.security;

import org.yaml.snakeyaml.Yaml;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 五层纵深权限检查核心引擎（PermissionChecker）。
 */
public class PermissionChecker {

    private PermissionMode mode;
    private final Path projectRoot;

    /** 危险 Shell 命令正则表达式模式库（Layer 1 防线） */
    private static final List<Pattern> DANGEROUS_PATTERNS = List.of(
            Pattern.compile("rm\\s+-[a-z]*r[a-z]*f[a-z]*\\s+/\\s*$", Pattern.CASE_INSENSITIVE),
            Pattern.compile("mkfs\\.", Pattern.CASE_INSENSITIVE),
            Pattern.compile("dd\\s+if=.*of=/dev/", Pattern.CASE_INSENSITIVE),
            Pattern.compile("chmod\\s+-R\\s+777\\s+/", Pattern.CASE_INSENSITIVE),
            Pattern.compile(":\\(\\)\\{\\s*:\\|:&\\s*\\};:", Pattern.CASE_INSENSITIVE),
            Pattern.compile("curl\\s+.*\\|\\s*(ba)?sh", Pattern.CASE_INSENSITIVE),
            Pattern.compile("wget\\s+.*\\|\\s*(ba)?sh", Pattern.CASE_INSENSITIVE),
            Pattern.compile(">\\s*/dev/sd", Pattern.CASE_INSENSITIVE)
    );

    /** 安全命令前缀白名单（免二次审批） */
    private static final Set<String> SAFE_COMMANDS = Set.of(
            "ls", "pwd", "echo", "cat", "head", "tail", "whoami", "date",
            "git status", "git log", "git diff", "node -v", "npm -v", "java -version"
    );

    /** 禁止 AI 写入的敏感受保护文件/目录相对路径 */
    private static final List<String> PROTECTED_WRITE_PATHS = List.of(
            ".butvan/config.json",
            ".butvan/permissions.yaml",
            ".butvan/permissions.local.yaml"
    );

    /** 解析装载的权限规则列表 */
    private final List<PermissionRule> fileRules;
    /** 运行时“始终允许 (Always Allow)”记录集 */
    private final Set<String> allowAlwaysRules = new HashSet<>();

    public PermissionChecker(PermissionMode mode, Path projectRoot) {
        this.mode = mode != null ? mode : PermissionMode.DEFAULT;
        this.projectRoot = projectRoot != null ? projectRoot.toAbsolutePath().normalize() : Paths.get(".").toAbsolutePath().normalize();
        this.fileRules = new ArrayList<>(loadRules());
    }

    public PermissionMode getMode() { return mode; }
    public void setMode(PermissionMode mode) { this.mode = mode; }

    /**
     * 获取从三层 YAML 配置文件解析出的只读规则列表，供 AgentSecurity 注入 AgentScope 使用。
     *
     * @return 不可变规则列表
     */
    public List<PermissionRule> getFileRules() {
        return Collections.unmodifiableList(fileRules);
    }

    /**
     * 核心公开方法：对某次工具调用参数执行五层纵深拦截检查。
     */
    public PermissionResult check(String toolName, Map<String, Object> args) {
        String content = extractContent(toolName, args);

        // === Layer 1: 危险命令硬拦截 ===
        if ("Bash".equalsIgnoreCase(toolName) && content != null) {
            if (isSafeCommand(content)) {
                return PermissionResult.allow();
            }
            for (Pattern pattern : DANGEROUS_PATTERNS) {
                if (pattern.matcher(content).find()) {
                    return PermissionResult.deny("[第1层防线] 检测到严重高危命令: " + content);
                }
            }
        }

        // === Layer 2: 路径沙箱保护 ===
        if (content != null && isFileTool(toolName)) {
            if (isWriteTool(toolName) && isProtectedPath(content)) {
                return PermissionResult.deny("[第2层防线] 禁止写入系统受保护的敏感文件: " + content);
            }
            if (!isWithinSandbox(content) && mode != PermissionMode.BYPASS) {
                return PermissionResult.deny("[第2层防线] 操作路径超出了项目许可沙箱范围: " + content);
            }
        }

        // === Layer 3: 三层 YAML 规则匹配 ===
        if (content != null) {
            if (allowAlwaysRules.contains(toolName + ":" + content)) {
                return PermissionResult.allow();
            }
            for (int i = fileRules.size() - 1; i >= 0; i--) {
                PermissionRule rule = fileRules.get(i);
                if (rule.matches(toolName, content)) {
                    return switch (rule.effect()) {
                        case ALLOW -> PermissionResult.allow();
                        case DENY -> PermissionResult.deny("[第3层防线] 命中配置文件拒绝规则: " + rule.toolName() + "(" + rule.pattern() + ")");
                        case ASK -> PermissionResult.ask("[第3层防线] 命中需要确认规则: " + rule.toolName() + "(" + rule.pattern() + ")");
                    };
                }
            }
        }

        // === Layer 4: 权限模式矩阵决策 ===
        PermissionMode.ToolCategory category = resolveCategory(toolName);
        PermissionMode.Decision modeDecision = mode.decide(category);

        return switch (modeDecision) {
            case ALLOW -> PermissionResult.allow();
            case DENY -> PermissionResult.deny("[第4层防线] 被当前权限模式 " + mode + " 拒绝");
            case ASK -> PermissionResult.ask("[第4层防线] 模式 " + mode + " 要求用户确认该操作");
        };
    }

    public void appendLocalRule(String toolName, String pattern) {
        allowAlwaysRules.add(toolName + ":" + pattern);
        if (projectRoot == null) return;

        Path localYaml = projectRoot.resolve(".butvan").resolve("permissions.local.yaml");
        try {
            Files.createDirectories(localYaml.getParent());
            List<Map<String, String>> entries = new ArrayList<>();
            if (Files.exists(localYaml)) {
                Yaml yaml = new Yaml();
                Object loaded = yaml.load(Files.readString(localYaml));
                if (loaded instanceof List<?> list) {
                    for (Object item : list) {
                        if (item instanceof Map<?, ?> m) {
                            entries.add(Map.of(
                                    "rule", String.valueOf(m.get("rule")),
                                    "effect", String.valueOf(m.get("effect"))
                            ));
                        }
                    }
                }
            }
            entries.add(Map.of("rule", toolName + "(" + pattern + ")", "effect", "allow"));
            Yaml yaml = new Yaml();
            Files.writeString(localYaml, yaml.dump(entries));
        } catch (IOException ignored) {}
    }

    private List<PermissionRule> loadRules() {
        List<PermissionRule> rules = new ArrayList<>();
        Path home = Paths.get(System.getProperty("user.home"));
        rules.addAll(loadRulesFile(home.resolve(".butvan").resolve("permissions.yaml")));

        if (projectRoot != null) {
            rules.addAll(loadRulesFile(projectRoot.resolve(".butvan").resolve("permissions.yaml")));
            rules.addAll(loadRulesFile(projectRoot.resolve(".butvan").resolve("permissions.local.yaml")));
        }
        return rules;
    }

    private List<PermissionRule> loadRulesFile(Path path) {
        if (!Files.exists(path)) return List.of();
        try {
            Yaml yaml = new Yaml();
            Object parsed = yaml.load(Files.readString(path));
            if (!(parsed instanceof List<?> list)) return List.of();

            List<PermissionRule> result = new ArrayList<>();
            Pattern ruleRegex = Pattern.compile("^(\\w+)\\((.+)\\)$");

            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    String ruleStr = String.valueOf(map.get("rule"));
                    String effectStr = String.valueOf(map.get("effect"));

                    PermissionMode.Decision effect = switch (effectStr.toLowerCase()) {
                        case "allow" -> PermissionMode.Decision.ALLOW;
                        case "deny" -> PermissionMode.Decision.DENY;
                        default -> PermissionMode.Decision.ASK;
                    };

                    Matcher m = ruleRegex.matcher(ruleStr.trim());
                    if (m.matches()) {
                        result.add(new PermissionRule(m.group(1), m.group(2), effect));
                    }
                }
            }
            return result;
        } catch (Exception e) {
            return List.of();
        }
    }

    private boolean isSafeCommand(String cmd) {
        String trimmed = cmd.trim();
        if (trimmed.contains("|") || trimmed.contains(";") || trimmed.contains("&&") || trimmed.contains(">")) {
            return false;
        }
        return SAFE_COMMANDS.stream().anyMatch(safe -> trimmed.equals(safe) || trimmed.startsWith(safe + " "));
    }

    private boolean isWithinSandbox(String pathStr) {
        try {
            Path p = Paths.get(pathStr).toAbsolutePath().normalize();
            if (Files.exists(p)) {
                p = p.toRealPath();
            } else if (p.getParent() != null && Files.exists(p.getParent())) {
                p = p.getParent().toRealPath().resolve(p.getFileName());
            }

            Path root = projectRoot.toAbsolutePath().normalize();
            Path tmp = Paths.get(System.getProperty("java.io.tmpdir")).toAbsolutePath().normalize();
            return p.startsWith(root) || p.startsWith(tmp);
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isProtectedPath(String pathStr) {
        if (projectRoot == null) return false;
        Path target = Paths.get(pathStr).toAbsolutePath().normalize();
        for (String rel : PROTECTED_WRITE_PATHS) {
            Path protectedPath = projectRoot.resolve(rel).toAbsolutePath().normalize();
            if (target.startsWith(protectedPath)) {
                return true;
            }
        }
        return false;
    }

    private boolean isFileTool(String name) {
        return "ReadFile".equalsIgnoreCase(name) || "WriteFile".equalsIgnoreCase(name) || "EditFile".equalsIgnoreCase(name);
    }

    private boolean isWriteTool(String name) {
        return "WriteFile".equalsIgnoreCase(name) || "EditFile".equalsIgnoreCase(name);
    }

    private PermissionMode.ToolCategory resolveCategory(String name) {
        if ("Bash".equalsIgnoreCase(name)) return PermissionMode.ToolCategory.COMMAND;
        if (isWriteTool(name)) return PermissionMode.ToolCategory.WRITE_FILE;
        return PermissionMode.ToolCategory.READ_ONLY;
    }

    private String extractContent(String name, Map<String, Object> args) {
        if (args == null) return null;
        if ("Bash".equalsIgnoreCase(name)) return (String) args.get("command");
        if (isFileTool(name)) return (String) args.get("file_path");
        return null;
    }
}
```

---

## 8. 第五步：编写 AgentScope 安全适配中心 (`AgentSecurity.java`)

在 `butvan.agent.agents.security` 包下修改 `AgentSecurity.java`，实现将 `PermissionChecker` 加载的动态规则与防线真正转换为 AgentScope 原生的 `PermissionRule` 并注入 `PermissionContextState`：

```java
package butvan.agent.agents.security;

import io.agentscope.core.permission.PermissionBehavior;
import io.agentscope.core.permission.PermissionContextState;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * 智能体安全与 AgentScope PermissionContext 适配中心。
 * <p>
 * 负责将五层纵深权限检查引擎（{@link PermissionChecker}）加载的三层 YAML 规则
 * 及硬拦截规则真正转换为 AgentScope 原生 {@link io.agentscope.core.permission.PermissionRule} 并注入框架。
 */
@Slf4j
@Component
public class AgentSecurity {

    /**
     * 构建并返回真正集成了五层防御规则的 AgentScope 原生 PermissionContextState。
     *
     * @param checker 五层纵深权限检查引擎
     * @return 注入完规则的 PermissionContextState 实例
     */
    public PermissionContextState createPermissionContext(PermissionChecker checker) {
        PermissionContextState.Builder builder = PermissionContextState.builder();

        if (checker == null) {
            return builder.build();
        }

        // 1. 将第 1 层高危命令硬拦截规则注册到 AgentScope 原生上下文
        builder.addDenyRule("Bash", new io.agentscope.core.permission.PermissionRule(
                "Bash", "rm -rf*", PermissionBehavior.DENY, "Layer1-DangerousHardDeny"
        ));

        // 2. 将 PermissionChecker 从 YAML 加载的三层规则转化为 AgentScope 原生规则
        List<PermissionRule> rules = checker.getFileRules();
        for (PermissionRule rule : rules) {
            PermissionBehavior behavior = switch (rule.effect()) {
                case ALLOW -> PermissionBehavior.ALLOW;
                case DENY -> PermissionBehavior.DENY;
                case ASK -> PermissionBehavior.ASK;
            };

            io.agentscope.core.permission.PermissionRule agentScopeRule =
                    new io.agentscope.core.permission.PermissionRule(
                            rule.toolName(),
                            rule.pattern(),
                            behavior,
                            "Layer3-YamlRule"
                    );

            if (behavior == PermissionBehavior.DENY) {
                builder.addDenyRule(rule.toolName(), agentScopeRule);
                log.info("[AgentSecurity] 成功向 AgentScope 注入 Deny 规则: {}({})", rule.toolName(), rule.pattern());
            } else if (behavior == PermissionBehavior.ALLOW) {
                builder.addAllowRule(rule.toolName(), agentScopeRule);
                log.info("[AgentSecurity] 成功向 AgentScope 注入 Allow 规则: {}({})", rule.toolName(), rule.pattern());
            }
        }

        return builder.build();
    }

    /**
     * 运行时对带有具体参数 Map 的工具调用执行五层防线动态判定（如校验绝对路径/Symlink 是否超出沙箱）。
     *
     * @param checker  五层权限检查引擎
     * @param toolName 工具名称
     * @param args     工具传入的实际参数 Map
     * @return AgentScope 原生 PermissionBehavior
     */
    public PermissionBehavior evaluatePermission(PermissionChecker checker, String toolName, Map<String, Object> args) {
        if (checker == null) {
            return PermissionBehavior.ALLOW;
        }

        PermissionResult result = checker.check(toolName, args);

        return switch (result.decision()) {
            case ALLOW -> PermissionBehavior.ALLOW;
            case DENY -> {
                log.warn("[AgentSecurity] 动态沙箱/正则防线拦截工具调用: {} -> {}", toolName, result.reason());
                yield PermissionBehavior.DENY;
            }
            case ASK -> {
                log.info("[AgentSecurity] 触发 HITL 审批: {} -> {}", toolName, result.reason());
                yield PermissionBehavior.ASK;
            }
        };
    }
}
```

---

## 9. 第六步：在 `AgentService.java` 中接入权限校验

更新 `AgentService.java`，将 `permissionChecker` 正确传递给 `agentSecurity.createPermissionContext(...)`：

```java
package butvan.agent.agents.agent;

import butvan.agent.agents.security.AgentSecurity;
import butvan.agent.agents.security.PermissionChecker;
import butvan.agent.agents.security.PermissionMode;
import io.agentscope.harness.agent.HarnessAgent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.file.Paths;

@Slf4j
@Service
@RequiredArgsConstructor
public class AgentService {

    private final ToolRegistry toolRegistry;
    private final AgentSecurity agentSecurity;

    private final PermissionChecker permissionChecker = new PermissionChecker(
            PermissionMode.DEFAULT,
            Paths.get(".").toAbsolutePath().normalize()
    );

    /**
     * 创建当前模型对应的 HarnessAgent，并装配集成了五层纵深规则的 PermissionContext。
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
                // 重点：将包含了三层 YAML 规则与硬拦截的 permissionChecker 传递给 AgentSecurity 构建原生上下文
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

## 10. 建议的实施顺序与验证方式

| 次序 | 手动编写的代码内容 | 位置 | 成功验证标志 |
| --- | --- | --- | --- |
| 1 | 编写 `PermissionMode.java` | `security/PermissionMode.java` | 模式枚举与分类 `decide` 方法编译通过。 |
| 2 | 编写 `PermissionRule.java` | `security/PermissionRule.java` | Glob 正则转换匹配方法编译通过。 |
| 3 | 编写 `PermissionResult.java` | `security/PermissionResult.java` | 静态构建工厂方法编译通过。 |
| 4 | 编写 `PermissionChecker.java` | `security/PermissionChecker.java` | 包含 `getFileRules()` 导出接口，五层纵深检查 `check` 方法编译通过。 |
| 5 | 编写 `AgentSecurity.java` | `security/AgentSecurity.java` | 包含 `createPermissionContext(checker)`，可将 `checker` 规则真实转化为 AgentScope `PermissionRule`。 |
| 6 | 在 `AgentService.java` 中接入 | `agent/AgentService.java` | 启动后端，查看控制台日志输出 `[AgentSecurity] 成功向 AgentScope 注入 Allow/Deny 规则`。 |

---

## 11. 最终代码职责表

| 类名 | 归属规范 | 职责与作用 |
| --- | --- | --- |
| `PermissionMode` | 安全决策矩阵 | 定义 4 种信任模式及不同工具分类下的默认决策逻辑。 |
| `PermissionRule` | 规则表达式模型 | 转换与执行 `ToolName(pattern)` 的 Simple Glob 表达式匹配。 |
| `PermissionResult` | 校验结果载体 | 封装包含 ALLOW / DENY / ASK 决策及防线拦截说明的响应对象。 |
| `PermissionChecker` | 纵深防御引擎 | 顺序调度 5 层拦截管道（黑名单、沙箱、规则、模式、HITL），并解析 3 层 YAML。 |
| `AgentSecurity` | AgentScope 适配中心 | 将 `PermissionChecker` 加载的动态与硬拦截规则真正转化为 AgentScope 原生 `PermissionRule` 并注入 `PermissionContextState`。 |
| `AgentService` | 业务调度服务 | 在生成 `HarnessAgent` 时调用 `agentSecurity.createPermissionContext(permissionChecker)` 完成装配。 |
