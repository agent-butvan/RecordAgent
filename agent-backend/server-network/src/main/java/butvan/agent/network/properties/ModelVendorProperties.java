package butvan.agent.network.properties;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 模型供应商配置属性类
 * 用于绑定 application-vendor.yml 中配置的 model.vendor 列表
 */
@Data
@Component
@ConfigurationProperties(prefix = "model")
public class ModelVendorProperties {

    /**
     * 系统支持的模型厂商列表（如 gemini, openai, deepseek 等）
     */
    private List<String> vendor;
}
