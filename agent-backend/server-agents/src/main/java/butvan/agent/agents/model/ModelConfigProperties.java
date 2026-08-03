package butvan.agent.agents.model;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "agent.model")
public class ModelConfigProperties {

    /**
     * 模型厂商
     */
    private String vendor;

    /**
     * 模型名称
     */
    private String name;

    /**
     * api key
     */
    private String apiKey;

    /**
     * 温度系数，默认 0.7
     */
    private Double temperature = 0.7;

    /**
     * 是否开启流失输出
     */
    private Boolean stream = true;

    public ModelSelector toSelector() {
        return new ModelSelector(vendor, name, apiKey, temperature, stream);
    }
}
