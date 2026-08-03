package butvan.agent.agents.model.registry;

import butvan.agent.agents.model.config.ModelProviderProperties;
import butvan.agent.agents.model.dto.ModelSelector;
import butvan.agent.agents.model.factory.AgentScopeModelFactory;
import io.agentscope.core.model.Model;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class AgentScopeModelRegistry {

    private final ModelProviderProperties modelProviderProperties;

    // 厂商配置表
    private final Map<String, ModelProviderProperties.ProviderConfig> vendorCache = new ConcurrentHashMap<>();

    // 动态 Model 实例缓存 (cacheKey: vendor:modelName -> Model)
    private final Map<String, Model> modelInstanceCache = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        log.info("Init AgentScope VendorRegistry...");
        Map<String, ModelProviderProperties.ProviderConfig> vendors = modelProviderProperties.getVendors();
        if (vendors != null) {
            vendors.forEach((name, config) -> {
                config.setName(name);
                vendorCache.put(name, config);
                log.info("Registered vendor provider: [{}] - protocol: {}", name, config.getProtocol());
            });
        }
    }

    /**
     * 根据 ModelSelector 获取或构建 AgentScope Model
     */
    public Model getModel(ModelSelector selector) {
        String vendorName = (selector.vendor() != null && !selector.vendor().isBlank())
                ? selector.vendor()
                : modelProviderProperties.getDefaultVendor();

        String modelName = (selector.modelName() != null && !selector.modelName().isBlank())
                ? selector.modelName()
                : modelProviderProperties.getDefaultModel();

        ModelProviderProperties.ProviderConfig vendorConfig = vendorCache.get(vendorName);
        if (vendorConfig == null) {
            throw new IllegalArgumentException("Vendor provider [" + vendorName + "] is not registered in system!");
        }

        // 缓存 key
        String cacheKey = vendorName + ":" + modelName;
        return modelInstanceCache.computeIfAbsent(cacheKey, k -> AgentScopeModelFactory.createModel(vendorConfig, selector));
    }

    public Model getModel(String vendor, String modelName) {
        return getModel(ModelSelector.of(vendor, modelName));
    }

    /**
     * 动态注册或更换厂商配置
     */
    public void updateVendorConfig(String vendorName, ModelProviderProperties.ProviderConfig config) {
        config.setName(vendorName);
        vendorCache.put(vendorName, config);
        // 清理改厂商模型缓存
        modelInstanceCache.keySet().removeIf(key -> key.startsWith(vendorName + ":"));
        log.info("Updated Vendor Config for [{}] and invalidated model caches.", vendorName);
    }

    /**
     * 获取系统默认模型
     */
    public Model getDefaultModel() {
        return getModel(modelProviderProperties.getDefaultVendor(), modelProviderProperties.getDefaultModel());
    }
}
