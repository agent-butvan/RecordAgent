package butvan.agent.agents.agent;

import butvan.agent.agents.storage.AgentStorageProperties;
import io.agentscope.core.state.AgentStateStore;
import io.agentscope.core.state.JsonFileAgentStateStore;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AgentRuntimeConfiguration {

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
