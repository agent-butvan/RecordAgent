package butvan.agent.agents.model.factory;

import butvan.agent.agents.model.config.ModelProviderProperties.ProviderConfig;
import butvan.agent.agents.model.dto.ModelSelector;
import io.agentscope.core.model.Model;
import io.agentscope.extensions.model.dashscope.DashScopeChatModel;
import io.agentscope.extensions.model.openai.OpenAIChatModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 模型构建工厂
 */
public class AgentScopeModelFactory {

    private static final Logger log = LoggerFactory.getLogger(AgentScopeModelFactory.class);

    public static Model createModel(ProviderConfig providerConfig, ModelSelector selector) {
        String protocol = providerConfig.getProtocol() != null ? providerConfig.getProtocol().toLowerCase() : "";

        // 优先使用请求级自定义 key/url
        String apiKey = (selector.customApiKey() != null && !selector.customApiKey().isBlank())
                ? selector.customApiKey()
                : resolveApiKey(providerConfig);

        String baseUrl = (selector.customBaseUrl() != null && !selector.customBaseUrl().isBlank())
                ? selector.customBaseUrl()
                : providerConfig.getBaseUrl();

        String targetModelId = selector.modelName();
        Double temp = selector.temperature() != null ? selector.temperature() : 0.7;

        log.info("Creating dynamic AgentScope Model - Vendor: [{}], Protocol: [{}], Target Model: [{}], BaseUrl: [{}]",
                providerConfig.getName(), protocol, targetModelId, baseUrl);

        switch (protocol) {
            case "dashscope":
                return DashScopeChatModel.builder()
                        .modelName(targetModelId)
                        .apiKey(apiKey)
                        .build();
            case "openai", "openai-compat":
                OpenAIChatModel.Builder openAiBuilder = OpenAIChatModel.builder()
                        .modelName(targetModelId)
                        .apiKey(apiKey);

                if (baseUrl != null && !baseUrl.isBlank()) {
                    openAiBuilder.baseUrl(baseUrl);
                }

                return openAiBuilder.build();
            default:
                throw new IllegalArgumentException("Unsupported protocol: [" + protocol + "] for vendor [" + providerConfig.getName() + "]");
        }
    }

    private static String resolveApiKey(ProviderConfig providerConfig) {
        if (providerConfig.getApiKey() != null && !providerConfig.getApiKey().isBlank()) {
            return providerConfig.getApiKey();
        }

        // 环境变量读取
        String envKey = switch (providerConfig.getProtocol()) {
            case "dashscope" -> System.getenv("DASHSCOPE_API_KEY");
            case "openai", "openai-compat" -> System.getenv("OPENAI_API_KEY");
            default -> null;
        };

        return envKey != null ? envKey : "";
    }
}
