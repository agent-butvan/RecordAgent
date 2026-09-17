package butvan.agent.agents.tool;

import io.agentscope.core.tool.Toolkit;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class ToolRegistry {

    private final Toolkit toolkit;

    public ToolRegistry(List<AgentToolModule> toolModules) {
        this.toolkit = new Toolkit();
        toolModules.forEach(this.toolkit::registerTool);
    }

    /**
     * 获取配置好的 AgentScope Toolkit 容器
     */
    public Toolkit getToolkit() {
        return this.toolkit;
    }

    /**
     * 为最终 Agent Toolkit 启用按需 Schema 路由。
     *
     * <p>必须在 HarnessAgent 完成内置工具注册后调用，确保框架工具和业务工具使用同一套路由策略。</p>
     */
    public void enableOnDemandSchemas(Toolkit agentToolkit) {
        ToolSchemaRoutingPolicy.apply(agentToolkit);
    }

}
