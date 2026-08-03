package butvan.agent.agents.model.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Data
@Component
@ConfigurationProperties(prefix = "agent.model")
public class ModelProviderProperties {

    /**
     * 默认厂商名称
     */
    private String defaultVendor = "dashscope";

    /**
     * 默认模型 ID
     */
    private String defaultModel = "qwen-max";

    /**
     * 多厂商模型配置字典 (匹配 agent.model.vendors)
     */
    private Map<String, ProviderConfig> vendors = new HashMap<>();

    @Data
    public static class ProviderConfig {
        private String name;
        private String protocol;
        private String baseUrl;
        private String apiKey;
        private boolean enabled = true;
    }
}
