package butvan.agent.network.service.impl;

import butvan.agent.agents.config.LocalConfigService;
import butvan.agent.agents.model.ModelHolder;
import butvan.agent.agents.model.ModelSelector;
import butvan.agent.network.dto.SetModel;
import butvan.agent.network.properties.ModelVendorProperties;
import butvan.agent.network.service.ModelService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;

/**
 * 模型网络服务接口实现类
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ModelServiceImpl implements ModelService {

    /**
     * 本地配置持久化服务
     */
    private final LocalConfigService localConfigService;

    /**
     * 内存模型持有者组件
     */
    private final ModelHolder modelHolder;

    /**
     * 模型供应商属性配置
     */
    private final ModelVendorProperties modelVendorProperties;

    /**
     * 动态更新并保存模型配置
     *
     * @param model 模型设置对象
     */
    @Override
    public void updateModelConfig(SetModel model) {
        if (model == null) {
            throw new IllegalArgumentException("设置模型配置参数 SetModel 不能为 null");
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

        log.info("成功动态更新模型配置: vendor={}, modelName={}", model.vendor(), model.modelName());
    }

    /**
     * 获取当前加载的模型配置
     *
     * @return ModelSelector
     */
    @Override
    public ModelSelector getModelConfig() {
        ModelSelector selector = modelHolder.getCurrentSelector();
        if (selector == null) {
            selector = localConfigService.loadOrInitializeConfig();
        }
        return selector;
    }

    /**
     * 获取系统支持的模型供应商列表
     *
     * @return 供应商列表
     */
    @Override
    public List<String> getSupportedVendors() {
        if (modelVendorProperties != null && modelVendorProperties.getVendor() != null) {
            return modelVendorProperties.getVendor();
        }
        return Collections.emptyList();
    }
}
