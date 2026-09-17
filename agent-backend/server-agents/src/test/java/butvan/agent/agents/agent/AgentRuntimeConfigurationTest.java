package butvan.agent.agents.agent;

import io.agentscope.core.shutdown.GracefulShutdownManager;
import io.agentscope.core.shutdown.PartialReasoningPolicy;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** 验证 AgentScope 停机不会退回无限等待。 */
class AgentRuntimeConfigurationTest {

    @Test
    void configuresBoundedAgentScopeShutdown() {
        var config = new AgentRuntimeConfiguration().agentScopeGracefulShutdownConfig();

        assertEquals(Duration.ofSeconds(5), config.shutdownTimeout());
        assertEquals(PartialReasoningPolicy.SAVE, config.partialReasoningPolicy());
        assertEquals(config, GracefulShutdownManager.getInstance().getConfig());
    }
}
