package butvan.agent.agents.config;

import butvan.agent.agents.model.ModelConfigProperties;
import butvan.agent.agents.model.ModelSelector;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;

@Service
public class LocalConfigService {

    private static final Logger log = LoggerFactory.getLogger(LocalConfigService.class);

    private final ObjectMapper objectMapper;
    private final Path configPath;

    public LocalConfigService() {
        this.objectMapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);
        String userHome = System.getProperty("user.home");
        this.configPath = Paths.get(userHome, ".butvan-agent", "config.json");
    }

    public static class ModelConfigData {
        private String vendor;
        private String name;
        private String apiKey;
        private Double temperature = 0.7;
        private Boolean stream = true;

        public ModelConfigData() {
        }

        public ModelConfigData(String vendor, String name, String apiKey, Double temperature, Boolean stream) {
            this.vendor = vendor;
            this.name = name;
            this.apiKey = apiKey;
            this.temperature = temperature;
            this.stream = stream;
        }

        public String getVendor() {
            return vendor;
        }

        public void setVendor(String vendor) {
            this.vendor = vendor;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getApiKey() {
            return apiKey;
        }

        public void setApiKey(String apiKey) {
            this.apiKey = apiKey;
        }

        public Double getTemperature() {
            return temperature;
        }

        public void setTemperature(Double temperature) {
            this.temperature = temperature;
        }

        public Boolean getStream() {
            return stream;
        }

        public void setStream(Boolean stream) {
            this.stream = stream;
        }

        public ModelSelector toSelector() {
            return new ModelSelector(vendor, name, apiKey, temperature, stream);
        }

        public static ModelConfigData fromSelector(ModelSelector selector) {
            return new ModelConfigData(
                    selector.vendor(),
                    selector.name(),
                    selector.apiKey(),
                    selector.temperature(),
                    selector.stream()
            );
        }
    }

    /**
     * 加载配置：优先读取 ~/.butvan-agent/config.json，
     * 若不存在则使用 application-agent.yml 的配置初始化并保存至本地文件
     */
    public ModelSelector loadOrInitializeConfig(ModelConfigProperties defaultProperties) {
        File configFile = configPath.toFile();
        if (configFile.exists() && configFile.isFile()) {
            try {
                ModelConfigData data = objectMapper.readValue(configFile, ModelConfigData.class);
                log.info("Loaded model config from local file: {}", configPath);
                return data.toSelector();
            } catch (Exception e) {
                log.error("Failed to read local config file from {}, falling back to default YML properties", configPath, e);
            }
        }

        // 文件不存在或读取失败：从 yml 的默认配置中生成 selector，并持久化保存
        ModelSelector defaultSelector = defaultProperties.toSelector();
        saveConfig(defaultSelector);
        return defaultSelector;
    }

    /**
     * 保存最新配置至 ~/.butvan-agent/config.json
     */
    public synchronized void saveConfig(ModelSelector selector) {
        try {
            File configFile = configPath.toFile();
            File parentDir = configFile.getParentFile();
            if (parentDir != null && !parentDir.exists()) {
                parentDir.mkdirs();
            }
            ModelConfigData data = ModelConfigData.fromSelector(selector);
            objectMapper.writeValue(configFile, data);
            log.info("Successfully saved model config to: {}", configPath);
        } catch (IOException e) {
            log.error("Failed to save model config to: {}", configPath, e);
        }
    }

    public Path getConfigPath() {
        return configPath;
    }
}
