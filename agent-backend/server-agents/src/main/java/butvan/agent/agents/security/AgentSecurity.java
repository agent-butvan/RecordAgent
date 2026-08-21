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
     *
     *
     * @param checker 权限检查与配置加载器
     * @return 组装完毕的 PermissionContextState 实例
     */
    public PermissionContextState createPermissionContext(PermissionChecker checker) {
        PermissionContextState.Builder builder = PermissionContextState.builder()
                .mode(checker == null ? PermissionMode.DEFAULT : checker.getMode());

        addAllow(builder, "read_file");
        addAllow(builder, "grep_files");
        addAllow(builder, "glob_files");
        addAllow(builder, "list_files");
        addAllow(builder, "memory_search");

        addAsk(builder, "write_file");
        addAsk(builder, "edit_file");
        addAsk(builder, "execute");
        addAllow(builder, "plan_exit");

        return builder.build();
    }


    private void addAllow(PermissionContextState.Builder builder, String toolName) {
        builder.addAllowRule(toolName, new PermissionRule(
                toolName, null, PermissionBehavior.ALLOW, "builtInReadOnly"
        ));
    }

    private void addAsk(PermissionContextState.Builder builder, String toolName) {
        builder.addAskRule(toolName, new PermissionRule(
                toolName, null, PermissionBehavior.ASK, "builtInHighRisk"
        ));
    }
}
