package butvan.agent.agents.model.dto;

/**
 * 运行时模型选择器
 * ModelSelector
 */
public record ModelSelector(
                String vendor,
                String modelName,
                Double temperature,
                String customBaseUrl,
                String customApiKey) {

        public static ModelSelector of(String vendor, String modelName) {
            return new ModelSelector(vendor, modelName, 0.7, null, null);
        }
                
}
