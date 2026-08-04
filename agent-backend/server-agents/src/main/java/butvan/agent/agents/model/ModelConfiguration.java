package butvan.agent.agents.model;

import butvan.agent.agents.config.LocalConfigService;
import io.agentscope.core.model.Model;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Slf4j
@Configuration
public class ModelConfiguration {

    @Bean
    public Model agentModel(ModelConfigProperties defaultProperties,
                           LocalConfigService localConfigService,
                           ModelHolder modelHolder) {
        ModelSelector selector = localConfigService.loadOrInitializeConfig(defaultProperties);
        modelHolder.updateModel(selector);
        return modelHolder.getModel();
    }
}

