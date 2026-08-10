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

        // 当处于 BYPASS 模式时，注册全局放行规则，避免未匹配工具误触发 ASK
        if (checker.getMode() == PermissionMode.BYPASS) {
            builder.addAllowRule("*", new io.agentscope.core.permission.PermissionRule(
                    "*", "*", PermissionBehavior.ALLOW, "Layer0-BypassMode"
            ));
            return builder.build();
        }

        // 1. 将第 1 层高危命令硬拦截规则注册到 AgentScope 原生上下文
        builder.addDenyRule("execute", new io.agentscope.core.permission.PermissionRule(
                "execute", "rm -rf*", PermissionBehavior.DENY, "Layer1-DangerousHardDeny"
        ));
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
