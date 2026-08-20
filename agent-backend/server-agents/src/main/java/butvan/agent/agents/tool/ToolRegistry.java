package butvan.agent.agents.tool;

import butvan.agent.agents.tool.impl.WebSearchTool;
import io.agentscope.core.tool.Toolkit;
import org.springframework.stereotype.Component;

@Component
public class ToolRegistry {

    private final Toolkit toolkit;

    public ToolRegistry(WebSearchTool webSearchTool) {
        this.toolkit = new Toolkit();

        this.toolkit.registerTool(webSearchTool);
    }

    /**
     * 获取配置好的 AgentScope Toolkit 容器
     */
    public Toolkit getToolkit() {
        return this.toolkit;
    }


}
