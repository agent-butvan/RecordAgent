package butvan.agent.agents.model.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * 厂商级大模型凭证配置类
 */
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
     * 厂商凭证配置字典
     */
    private Map<String, ProviderConfig> vendors = new HashMap<>();

    public String getDefaultVendor() {
        return defaultVendor;
    }

    public void setDefaultVendor(String defaultVendor) {
        this.defaultVendor = defaultVendor;
    }

    public String getDefaultModel() {
        return defaultModel;
    }

    public void setDefaultModel(String defaultModel) {
        this.defaultModel = defaultModel;
    }

    public Map<String, ProviderConfig> getVendors() {
        return vendors;
    }

    public void setVendors(Map<String, ProviderConfig> vendors) {
        this.vendors = vendors;
    }

    public static class ProviderConfig {
        private String name;
        private String protocol;
        private String baseUrl;
        private String apiKey;
        private boolean enabled = true;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getProtocol() {
            return protocol;
        }

        public void setProtocol(String protocol) {
            this.protocol = protocol;
        }

        public String getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
        }

        public String getApiKey() {
            return apiKey;
        }

        public void setApiKey(String apiKey) {
            this.apiKey = apiKey;
        }

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }
    }
}
