package butvan.agent.agents.agent;

import butvan.agent.agents.storage.AgentStorageProperties;
import io.agentscope.core.state.AgentStateStore;
import io.agentscope.core.state.JsonFileAgentStateStore;
import io.agentscope.core.shutdown.GracefulShutdownConfig;
import io.agentscope.core.shutdown.GracefulShutdownManager;
import io.agentscope.core.shutdown.PartialReasoningPolicy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Configuration
public class AgentRuntimeConfiguration {

    private static final Duration AGENT_SHUTDOWN_TIMEOUT = Duration.ofSeconds(5);

    /**
     * 限制 AgentScope 停机等待时间，避免模型或工具调用失联时无限阻塞 JVM 退出。
     * 未完成的推理仍按框架原生 SAVE 策略持久化。
     */
    @Bean
    public GracefulShutdownConfig agentScopeGracefulShutdownConfig() {
        GracefulShutdownConfig config = new GracefulShutdownConfig(
                AGENT_SHUTDOWN_TIMEOUT, PartialReasoningPolicy.SAVE);
        GracefulShutdownManager.getInstance().setConfig(config);
        return config;
    }

    /**
     * 创建唯一的状态存储
     * @param storageProperties
     * @return
     */
    @Bean(destroyMethod = "close")
    public AgentStateStore agentStateStore(AgentStorageProperties storageProperties) {
        return new JsonFileAgentStateStore(storageProperties.getAgentStateDirectory());
    }
}
