package butvan.agent.network.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ModelFetchRequest {

    /**
     * 模型厂商，例如: openai, gemini, dashscope, deepseek
     */
    private String vendor;

    /**
     * 厂商对应的 API Key
     */
    private String apiKey;
}
