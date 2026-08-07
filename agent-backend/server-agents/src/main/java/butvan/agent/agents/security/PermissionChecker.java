package butvan.agent.agents.security;

import org.yaml.snakeyaml.Yaml;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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
    public List<PermissionRule> getFileRules() { return java.util.Collections.unmodifiableList(fileRules); }

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
            if (isSafeCommand(content)) {
                return PermissionResult.allow();
            }
            for (Pattern pattern : DANGEROUS_PATTERNS) {
                if (pattern.matcher(content).find()) {
                    return PermissionResult.deny("[第1层防线] 检测到严重高危命令:" + content);
                }
            }
        }

        // === Layer 2: 路径沙箱保护 (文件类工具) ===
        if (content != null && isFileTool(toolName)) {
            if (isWriteTool(toolName) && isProtectedPath(content)) {
                return PermissionResult.deny("[第2层防线] 禁止写入系统受保护的敏感文件: " + content);
            }

            if (!isWithinSandbox(content) && mode != PermissionMode.BYPASS) {
                return PermissionResult.deny("[第2层防线] 操作路径超出了项目许可沙箱范围: " + content);
            }
        }

        // === Layer 3: 三层 YAML 规则匹配（从后向前，DENY 优先） ===
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

    private boolean isWriteTool(String name) {
        return "WriteFile".equalsIgnoreCase(name) || "EditorFile".equalsIgnoreCase(name);
    }

    private boolean isFileTool(String name) {
        return "ReadFile".equalsIgnoreCase(name) || "WriteFile".equalsIgnoreCase(name) || "EditFile".equalsIgnoreCase(name);
    }
    private PermissionMode.ToolCategory resolveCategory(String name) {
        if ("Bash".equalsIgnoreCase(name)) return PermissionMode.ToolCategory.COMMAND;
        if (isWriteTool(name)) return PermissionMode.ToolCategory.WRITE_FILE;
        return PermissionMode.ToolCategory.READ_ONLY;
    }

    private String extractContent(String name, Map<String,Object> args) {
        if (args == null) return null;
        if ("Bash".equalsIgnoreCase(name)) return (String) args.get("commond");
        if (isFileTool(name)) return (String) args.get("file_path");
        return null;
    }
}
