package butvan.agent.agents.config;

import butvan.agent.agents.model.ModelSelector;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * 本地模型配置持久化服务
 * 完全基于本地 ~/.butvan-agent/config.json 文件进行模型配置的管理、读取、保存与自动初始化
 */
@Slf4j
@Service
public class LocalConfigService {

    /**
     * JSON 格式化与序列化工具
     */
    private final ObjectMapper objectMapper;

    /**
     * 本地配置文件路径：~/.butvan-agent/config.json
     */
    private final Path configPath;

    /**
     * 构造函数：初始化 JSON 序列化工具并指定本地配置文件路径
     */
    public LocalConfigService() {
        this.objectMapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);
        String userHome = System.getProperty("user.home");
        this.configPath = Paths.get(userHome, ".butvan-agent", "config.json");
    }

    /**
     * 本地持久化模型配置数据结构
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ModelConfigData {

        /**
         * 模型厂商（如 gemini, openai, deepseek, dashscope, anthropic）
         */
        private String vendor = "gemini";

        /**
         * 模型具体名称（如 gemini-3.6-flash, gpt-4o 等）
         */
        private String name = "gemini-3.6-flash";

        /**
         * 模型 API Key
         */
        private String apiKey = "";

        /**
         * 温度系数（默认 0.7）
         */
        private Double temperature = 0.7;

        /**
         * 是否开启流式输出（默认 true）
         */
        private Boolean stream = true;

        /**
         * 将本地配置转换为 ModelSelector 领域模型
         *
         * @return ModelSelector
         */
        public ModelSelector toSelector() {
            return new ModelSelector(vendor, name, apiKey, temperature, stream);
        }

        /**
         * 从 ModelSelector 构建本地配置数据对象
         *
         * @param selector 模型选择器对象
         * @return ModelConfigData
         */
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
     * 加载本地配置：
     * 优先读取 ~/.butvan-agent/config.json；
     * 若文件不存在或读取失败，则自动基于代码内置的预设默认值创建并持久化写出 ~/.butvan-agent/config.json
     *
     * @return 当前生效的 ModelSelector
     */
    public ModelSelector loadOrInitializeConfig() {
        File configFile = configPath.toFile();
        if (configFile.exists() && configFile.isFile()) {
            try {
                ModelConfigData data = objectMapper.readValue(configFile, ModelConfigData.class);
                log.info("成功从本地文件读取模型配置: {}", configPath);
                return data.toSelector();
            } catch (Exception e) {
                log.error("读取本地模型配置文件失败 [{}]，将重置为默认初始配置并写出", configPath, e);
            }
        }

        // 文件不存在或读取异常：使用内置初始化配置生成 Selector 并写入本地 JSON 文件
        ModelConfigData defaultData = new ModelConfigData();
        ModelSelector defaultSelector = defaultData.toSelector();
        saveConfig(defaultSelector);
        return defaultSelector;
    }

    /**
     * 保存最新模型配置到本地配置文件 ~/.butvan-agent/config.json
     *
     * @param selector 需要保存的模型选择器对象
     */
    public synchronized void saveConfig(ModelSelector selector) {
        try {
            File configFile = configPath.toFile();
            File parentDir = configFile.getParentFile();
            // 如果父目录 ~/.butvan-agent 不存在，则自动创建
            if (parentDir != null && !parentDir.exists()) {
                parentDir.mkdirs();
            }
            ModelConfigData data = ModelConfigData.fromSelector(selector);
            objectMapper.writeValue(configFile, data);
            log.info("成功保存模型配置至本地文件: {}", configPath);
        } catch (IOException e) {
            log.error("保存模型配置到本地文件失败: {}", configPath, e);
        }
    }

    /**
     * 获取本地配置文件路径
     *
     * @return Path 配置文件路径对象
     */
    public Path getConfigPath() {
        return configPath;
    }
}
