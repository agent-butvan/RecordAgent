package butvan.agent.agents.model;

import io.agentscope.core.model.Model;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ModelConfiguration {

    @Bean
    public Model agenModel(ModelConfigProperties modelConfigProperties) {
        ModelSelector selector = modelConfigProperties.toSelector();

        return ModelFactory.create(selector);
    }
}
