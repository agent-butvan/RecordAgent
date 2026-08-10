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
                log.info("[AgentSecurity] 成功向 AgentScope 注入 Deny 规则: {}({})", rule.toolName(), rule.ruleContent());
            } else if (rule.behavior() == PermissionBehavior.ALLOW) {
                builder.addAllowRule(rule.toolName(), rule);
                log.info("[AgentSecurity] 成功向 AgentScope 注入 Allow 规则: {}({})", rule.toolName(), rule.ruleContent());
            } else if (rule.behavior() == PermissionBehavior.ASK) {
                builder.addAskRule(rule.toolName(), rule);
                log.info("[AgentSecurity] 成功向 AgentScope 注入 Ask 规则: {}({})", rule.toolName(), rule.ruleContent());
            }
        }

        return builder.build();
    }
}
