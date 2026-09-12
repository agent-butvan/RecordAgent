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


}
