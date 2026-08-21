package butvan.agent.agents.tool;

import butvan.agent.agents.tool.impl.AcceptanceReportTool;
import butvan.agent.agents.tool.impl.WebSearchTool;
import io.agentscope.core.tool.Toolkit;
import org.springframework.stereotype.Component;

@Component
public class ToolRegistry {

    private final Toolkit toolkit;

    public ToolRegistry(
            WebSearchTool webSearchTool,
            AcceptanceReportTool acceptanceReportTool
    ) {
        this.toolkit = new Toolkit();

        this.toolkit.registerTool(webSearchTool);
        this.toolkit.registerTool(acceptanceReportTool);
    }

    /**
     * 获取配置好的 AgentScope Toolkit 容器
     */
    public Toolkit getToolkit() {
        return this.toolkit;
    }


}
