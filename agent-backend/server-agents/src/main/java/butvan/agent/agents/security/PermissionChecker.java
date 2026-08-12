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
