# ButvanAgent 五层纵深权限防御架构与接入教程

## 1. 这份文档解决什么问题

在桌面智能体（`ButvanAgent`）的运行过程中，大模型具备执行 Shell 命令、修改本地文件、删除代码与调用系统工具的能力。如果缺乏严密的安全防护，Agent 可能由于错误推理或**间接 Prompt 注入攻击**（如被代码库中恶意 Markdown 诱导）执行 `rm -rf /`、删库、修改敏感配置或泄露 API Key。

**核心原则**：
1. **纵深防御 (Defense in Depth)**：叠加 5 道互补的防线，上一层拦截失败时下一层兜底，确保单个防线失效不会导致系统崩溃。
2. **硬防线与软策略结合**：危险命令与路径沙箱为**硬防线**（任何模式与白名单均无法绕过）；规则匹配与模式决策为**软策略**（可根据场景灵活调整）。
3. **闭环学习机制 (HITL)**：人在回路审批时提供“始终允许”选项，自动记录并持久化本地规则，形成越用越智能且安全基线不降低的**权限学习循环**。

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
└─────────────────────────────────────────────────────────┘
```

---

## 3. 包结构与目录规划

在后端 `agent-backend/server-agents` 模块的 `src/main/java/butvan/agent/agents/` 路径下规划安全权限包：

```text
butvan.agent.agents.security/
├── PermissionMode.java          // 权限模式枚举与分类决策矩阵
├── PermissionRule.java          // YAML 规则项模型与 Glob 匹配器
├── PermissionResult.java        // 校验决策结果记录类
└── PermissionChecker.java       // 五层纵深权限检查核心引擎
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
        // 将特殊的正则元字符进行转义，将 * 替换为 .*，? 替换为 .
        String regex = "^" + Pattern.quote(globPattern)
                .replace("*", "\\E.*\\Q")
                .replace("?", "\\E.\\Q") + "$";
        // 清理空转义
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

在 `butvan.agent.agents.security` 包下创建 `PermissionChecker.java`：

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
 * <p>
 * 在 Agent 每次调用敏感工具前执行五层顺序拦截判断：
 * <ol>
 *   <li><b>Layer 1: 危险命令硬拦截</b> —— 正则匹配如 rm -rf / 等高危 Shell 命令（不可覆盖）。</li>
 *   <li><b>Layer 2: 路径沙箱保护</b> —— 解析绝对路径与 Symlink，阻止读取项目外文件或修改保护路径（不可覆盖）。</li>
 *   <li><b>Layer 3: 三层 YAML 规则匹配</b> —— 加载用户级、项目级、本地级配置文件，支持 DENY 跨层硬合并。</li>
 *   <li><b>Layer 4: 权限模式矩阵决策</b> —— 根据当前 {@link PermissionMode} 决定默认策略。</li>
 *   <li><b>Layer 5: HITL 人在回路</b> —— 挂起并在前端提示用户确认，支持“始终允许”自动持久化到本地规则。</li>
 * </ol>
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

    /**
     * 构造权限检查器。
     *
     * @param mode        初始运行权限模式
     * @param projectRoot 当前项目根路径
     */
    public PermissionChecker(PermissionMode mode, Path projectRoot) {
        this.mode = mode != null ? mode : PermissionMode.DEFAULT;
        this.projectRoot = projectRoot != null ? projectRoot.toAbsolutePath().normalize() : Paths.get(".").toAbsolutePath().normalize();
        this.fileRules = new ArrayList<>(loadRules());
    }

    public PermissionMode getMode() { return mode; }
    public void setMode(PermissionMode mode) { this.mode = mode; }

    /**
     * 核心公开方法：对某次工具调用参数执行五层纵深拦截检查。
     *
     * @param toolName 工具名称（如 Bash, ReadFile, WriteFile 等）
     * @param args     LLM 传入的参数 Map
     * @return 最终的校验决策结果 {@link PermissionResult}
     */
    public PermissionResult check(String toolName, Map<String, Object> args) {
        String content = extractContent(toolName, args);

        // === Layer 1: 危险命令硬拦截 (Bash 工具) ===
        if ("Bash".equalsIgnoreCase(toolName) && content != null) {
            // 1a. 安全命令速放
            if (isSafeCommand(content)) {
                return PermissionResult.allow();
            }
            // 1b. 高危正则匹配硬拒绝
            for (Pattern pattern : DANGEROUS_PATTERNS) {
                if (pattern.matcher(content).find()) {
                    return PermissionResult.deny("[第1层防线] 检测到严重高危命令: " + content);
                }
            }
        }

        // === Layer 2: 路径沙箱保护 (文件类工具) ===
        if (content != null && isFileTool(toolName)) {
            // 2a. 写入敏感配置文件保护
            if (isWriteTool(toolName) && isProtectedPath(content)) {
                return PermissionResult.deny("[第2层防线] 禁止写入系统受保护的敏感文件: " + content);
            }
            // 2b. 路径越界沙箱检查
            if (!isWithinSandbox(content) && mode != PermissionMode.BYPASS) {
                return PermissionResult.deny("[第2层防线] 操作路径超出了项目许可沙箱范围: " + content);
            }
        }

        // === Layer 3: 三层 YAML 规则匹配（从后向前，DENY 优先） ===
        if (content != null) {
            // 3a. 会话内“始终允许”命中
            if (allowAlwaysRules.contains(toolName + ":" + content)) {
                return PermissionResult.allow();
            }
            // 3b. 校验 YAML 规则集
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

    /**
     * 当用户在 HITL 弹窗中选择“始终允许”时，将规则追加到本地 permissions.local.yaml 集中。
     *
     * @param toolName 工具名称
     * @param pattern  匹配模式
     */
    public void appendLocalRule(String toolName, String pattern) {
        allowAlwaysRules.add(toolName + ":" + pattern);
        if (projectRoot == null) return;

        Path localYaml = projectRoot.resolve(".butvan").resolve("permissions.local.yaml");
        try {
            Files.createDirectories(localYaml.getParent());
            List<Map<String, String>> entries = new ArrayList<>();
            
            // 读取原有规则列表并追加新规则
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

    // ── 内部私有辅助逻辑 ──────────────────────────────────────────────────

    private List<PermissionRule> loadRules() {
        List<PermissionRule> rules = new ArrayList<>();
        // 1. 加载全局 ~/.butvan/permissions.yaml
        Path home = Paths.get(System.getProperty("user.home"));
        rules.addAll(loadRulesFile(home.resolve(".butvan").resolve("permissions.yaml")));

        // 2. 加载项目级 {projectRoot}/.butvan/permissions.yaml
        if (projectRoot != null) {
            rules.addAll(loadRulesFile(projectRoot.resolve(".butvan").resolve("permissions.yaml")));
            // 3. 加载本地覆盖 {projectRoot}/.butvan/permissions.local.yaml
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
            // 解析软链接防止 symlink 逃逸
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

## 8. 第五步：在 `AgentService.java` 中接入权限校验

更新 `AgentService.java`，在触发工具前执行权限校验，被拒绝时产生 `isError: true` 错误结果，确保大模型可以自适应调整策略：

```java
package butvan.agent.agents.agent;

import butvan.agent.agents.security.PermissionChecker;
import butvan.agent.agents.security.PermissionMode;
import butvan.agent.agents.security.PermissionResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.file.Paths;
import java.util.Map;

@Slf4j
@Service
public class AgentService {

    private final PermissionChecker permissionChecker = new PermissionChecker(
            PermissionMode.DEFAULT,
            Paths.get(".").toAbsolutePath().normalize()
    );

    /**
     * 在发起工具调用前执行纵深权限校验。
     *
     * @param toolName 工具名称
     * @param args     参数 Map
     * @return 若通过或用户同意返回 true；被拦截返回 false（产生 errorResult 传给大模型）
     */
    public boolean authorizeToolCall(String toolName, Map<String, Object> args) {
        PermissionResult result = permissionChecker.check(toolName, args);

        switch (result.decision()) {
            case ALLOW -> {
                log.info("[Permission] 工具调用审批放行: {} -> {}", toolName, result.reason());
                return true;
            }
            case DENY -> {
                log.warn("[Permission] 工具调用被安全拒绝: {} -> {}", toolName, result.reason());
                return false;
            }
            case ASK -> {
                log.info("[Permission] 触发第5层 HITL 人在回路审批: {}", result.reason());
                // 此处与前端 Tauri/SSE 协同，弹窗向用户请求确认 (y/n/a)
                // 若用户选择 (a) 始终允许，调用 permissionChecker.appendLocalRule(toolName, pattern);
                return handleUserHitlApproval(toolName, args);
            }
        }
        return false;
    }

    private boolean handleUserHitlApproval(String toolName, Map<String, Object> args) {
        // 模拟用户在前端点击同意
        return true;
    }
}
```

---

## 9. 建议的实施顺序与验证方式

| 次序 | 手动编写的代码内容 | 位置 | 成功验证标志 |
| --- | --- | --- | --- |
| 1 | 编写 `PermissionMode.java` | `security/PermissionMode.java` | 模式枚举与分类 `decide` 方法编译通过。 |
| 2 | 编写 `PermissionRule.java` | `security/PermissionRule.java` | Glob 正则转换匹配方法编译通过。 |
| 3 | 编写 `PermissionResult.java` | `security/PermissionResult.java` | 静态构建工厂方法编译通过。 |
| 4 | 编写 `PermissionChecker.java` | `security/PermissionChecker.java` | 五层纵深检查 `check` 方法编译通过。 |
| 5 | 在 `AgentService.java` 中接入 | `agent/AgentService.java` | 传入 `rm -rf /` 测试触发 DENY；传入 `ReadFile` 触发 ALLOW。 |

---

## 10. 最终代码职责表

| 类名 | 归属规范 | 职责与作用 |
| --- | --- | --- |
| `PermissionMode` | 安全决策矩阵 | 定义 4 种信任模式及不同工具分类下的默认决策逻辑。 |
| `PermissionRule` | 规则表达式模型 | 转换与执行 `ToolName(pattern)` 的 Simple Glob 表达式匹配。 |
| `PermissionResult` | 校验结果载体 | 封装包含 ALLOW / DENY / ASK 决策及防线拦截说明的响应对象。 |
| `PermissionChecker` | 纵深防御引擎 | 顺序调度 5 层拦截管道（黑名单、沙箱、规则、模式、HITL）。 |
| `AgentService` | 业务调度服务 | 在工具调用前触发权限校验，并将拒接结果作为错误报告回传给 LLM。 |
