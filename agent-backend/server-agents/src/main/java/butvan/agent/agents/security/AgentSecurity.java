package butvan.agent.agents.security;

import io.agentscope.core.permission.PermissionBehavior;
import io.agentscope.core.permission.PermissionContextState;
import io.agentscope.core.permission.PermissionRule;
import org.springframework.stereotype.Component;

@Component
public class AgentSecurity {

    /**
     * 构建权限策略：显式屏蔽 AgentScope Harness 默认自带的冲突工具，优先使用自定义工具
     */
    public PermissionContextState createPermissionContext() {
        PermissionContextState.Builder builder = PermissionContextState.builder();

        // 需屏蔽的默认冲突工具名称数组
        String[] denyTools = {};
        for (String tool : denyTools) {
            // 使用 addDenyRule 与 PermissionBehavior.DENY
            builder.addDenyRule(tool, new PermissionRule(tool, null, PermissionBehavior.DENY, "system"));
        }
        return builder.build();
    }
}
