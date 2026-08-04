package butvan.agent.network.service.impl;

import butvan.agent.agents.config.LocalConfigService;
import butvan.agent.agents.model.ModelHolder;
import butvan.agent.agents.model.ModelSelector;
import butvan.agent.network.dto.SetModel;
import butvan.agent.network.service.ModelService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class ModelServiceImpl implements ModelService {

    private static final Logger log = LoggerFactory.getLogger(ModelServiceImpl.class);

    private final LocalConfigService localConfigService;
    private final ModelHolder modelHolder;

    public ModelServiceImpl(LocalConfigService localConfigService, ModelHolder modelHolder) {
        this.localConfigService = localConfigService;
        this.modelHolder = modelHolder;
    }

    @Override
    public void updateModelConfig(SetModel model) {
        if (model == null) {
            throw new IllegalArgumentException("SetModel param cannot be null");
        }

        ModelSelector currentSelector = modelHolder.getCurrentSelector();
        Double temperature = currentSelector != null ? currentSelector.temperature() : 0.7;
        Boolean stream = currentSelector != null ? currentSelector.stream() : true;

        ModelSelector newSelector = new ModelSelector(
                model.vendor(),
                model.modelName(),
                model.apiKey(),
                temperature,
                stream
        );

        // 1. 持久化到 ~/.butvan-agent/config.json
        localConfigService.saveConfig(newSelector);

        // 2. 刷新内存模型
        modelHolder.updateModel(newSelector);

        log.info("Successfully updated model configuration: vendor={}, modelName={}", model.vendor(), model.modelName());
    }
}
