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
         * 模型厂商（初次初始化时为空字符串）
         */
        private String vendor = "";

        /**
         * 模型具体名称（初次初始化时为空字符串）
         */
        private String name = "";

        /**
         * 模型 API Key（初次初始化时为空字符串）
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
                    selector != null ? selector.vendor() : "",
                    selector != null ? selector.name() : "",
                    selector != null ? selector.apiKey() : "",
                    selector != null && selector.temperature() != null ? selector.temperature() : 0.7,
                    selector != null && selector.stream() != null ? selector.stream() : true
            );
        }
    }

    /**
     * 加载本地配置：
     * 优先读取 ~/.butvan-agent/config.json；
     * 若文件不存在或读取失败，则自动创建含有空字段属性的模板 ~/.butvan-agent/config.json 写出
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
                log.error("读取本地模型配置文件失败 [{}]，将自动初始化为空配置模板并写出", configPath, e);
            }
        }

        // 文件不存在或读取异常：自动创建所有内容字段均为空的配置模板文件
        ModelConfigData emptyData = new ModelConfigData("", "", "", 0.7, true);
        ModelSelector emptySelector = emptyData.toSelector();
        saveConfig(emptySelector);
        return emptySelector;
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
