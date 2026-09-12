package butvan.agent.agents.tool;

import io.agentscope.core.tool.Tool;
import io.agentscope.core.tool.ToolParam;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ToolRegistryTest {

    @Test
    void registersEveryDiscoveredToolModule() {
        ToolRegistry registry = new ToolRegistry(List.of(new FirstTool(), new SecondTool()));

        assertEquals(List.of("first_test_tool", "second_test_tool"),
                registry.getToolkit().getToolNames().stream().sorted().toList());
    }

    private static final class FirstTool implements AgentToolModule {
        @Tool(name = "first_test_tool", description = "第一个注册测试工具")
        public String run(@ToolParam(name = "value", description = "测试值") String value) {
            return value;
        }
    }

    private static final class SecondTool implements AgentToolModule {
        @Tool(name = "second_test_tool", description = "第二个注册测试工具")
        public String run(@ToolParam(name = "value", description = "测试值") String value) {
            return value;
        }
    }
}
