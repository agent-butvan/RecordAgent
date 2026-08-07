package butvan.agent.agents.tool;

import butvan.agent.agents.tool.impl.*;
import io.agentscope.core.tool.Toolkit;
import org.springframework.stereotype.Component;

@Component
public class ToolRegistry {

    private final Toolkit toolkit;

    public ToolRegistry() {
        this.toolkit = new Toolkit();

//        // 向 AgentScope Toolkit 注册所有的原生 @Tool 工具类组件
//        this.toolkit.registerTool(new BashTool());
//        this.toolkit.registerTool(new ReadFileTool());
//        this.toolkit.registerTool(new WriteFileTool());
//        this.toolkit.registerTool(new EditFileTool());
//        this.toolkit.registerTool(new GlobTool());
//        this.toolkit.registerTool(new GrepTool());
    }

    /**
     * 获取配置好的 AgentScope Toolkit 容器
     */
    public Toolkit getToolkit() {
        return this.toolkit;
    }


}
