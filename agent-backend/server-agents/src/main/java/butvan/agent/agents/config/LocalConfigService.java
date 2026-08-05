package butvan.agent.agents.config;

import butvan.agent.agents.model.ModelSelector;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import lombok.Data;
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
        this.objectMapper = new ObjectMapper()
                .enable(SerializationFeature.INDENT_OUTPUT)
                .configure(com.fasterxml.jackson.core.JsonParser.Feature.ALLOW_UNESCAPED_CONTROL_CHARS, true);
        String userHome = System.getProperty("user.home");
        this.configPath = Paths.get(userHome, ".butvan-agent", "config.json");
    }

    private String cleanString(String str) {
        if (str == null) return "";
        return str.trim().replaceAll("[\\r\\n]", "");
    }

    private void cleanModelConfigData(ModelConfigData data) {
        if (data == null) return;
        data.setVendor(cleanString(data.getVendor()));
        data.setName(cleanString(data.getName()));
        data.setApiKey(cleanString(data.getApiKey()));
        data.setActiveVendor(cleanString(data.getActiveVendor()));
        data.setActiveModel(cleanString(data.getActiveModel()));
        if (data.getProviders() != null) {
            for (ProviderConfigData provider : data.getProviders()) {
                provider.setId(cleanString(provider.getId()));
                provider.setName(cleanString(provider.getName()));
                provider.setType(cleanString(provider.getType()));
                provider.setApiKey(cleanString(provider.getApiKey()));
                if (provider.getModels() != null) {
                    for (ModelItemData model : provider.getModels()) {
                        model.setId(cleanString(model.getId()));
                        model.setName(cleanString(model.getName()));
                        model.setModelName(cleanString(model.getModelName()));
                        model.setProviderId(cleanString(model.getProviderId()));
                    }
                }
            }
        }
    }

    /**
     * 单个模型明细配置数据结构
     */
    @Data
    public static class ModelItemData {
        private String id = "";
        private String name = "";
        private String modelName = "";
        private String providerId = "";
        private String description = "";
        private Boolean supportsReasoning = false;

        public ModelItemData() {
        }

        public ModelItemData(String id, String name, String modelName, String providerId, String description, Boolean supportsReasoning) {
            this.id = id;
            this.name = name;
            this.modelName = modelName;
            this.providerId = providerId;
            this.description = description;
            this.supportsReasoning = supportsReasoning;
        }
    }

    /**
     * 模型厂商 Provider 配置数据结构
     */
    @Data
    public static class ProviderConfigData {
        private String id = "";
        private String name = "";
        private String type = "";
        private String apiKey = "";
        private Boolean isEnabled = true;
        private java.util.List<ModelItemData> models = new java.util.ArrayList<>();

        public ProviderConfigData() {
        }

        public ProviderConfigData(String id, String name, String type, String apiKey, Boolean isEnabled, java.util.List<ModelItemData> models) {
            this.id = id;
            this.name = name;
            this.type = type;
            this.apiKey = apiKey;
            this.isEnabled = isEnabled;
            this.models = models != null ? models : new java.util.ArrayList<>();
        }
    }

    /**
     * 本地持久化模型配置数据结构
     */
    @Data
    public static class ModelConfigData {

        /**
         * 当前激活厂商类型标识
         */
        private String activeVendor = "";

        /**
         * 当前激活模型标识/名称
         */
        private String activeModel = "";

        /**
         * 模型厂商（兼容单字段配置）
         */
        private String vendor = "";

        /**
         * 模型具体名称（兼容单字段配置）
         */
        private String name = "";

        /**
         * 模型 API Key（兼容单字段配置）
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
         * 多厂商模型配置列表
         */
        private java.util.List<ProviderConfigData> providers = new java.util.ArrayList<>();

        public ModelConfigData() {
        }

        public ModelConfigData(String vendor, String name, String apiKey, Double temperature, Boolean stream) {
            this.vendor = vendor;
            this.name = name;
            this.apiKey = apiKey;
            this.temperature = temperature;
            this.stream = stream;
            this.activeVendor = vendor;
            this.activeModel = name;
        }

        /**
         * 将本地配置转换为 ModelSelector 领域模型
         *
         * @return ModelSelector
         */
        public ModelSelector toSelector() {
            String targetVendor = (vendor != null && !vendor.isBlank()) ? vendor : activeVendor;
            String targetName = (name != null && !name.isBlank()) ? name : activeModel;
            String targetApiKey = apiKey != null ? apiKey : "";

            targetVendor = targetVendor != null ? targetVendor.trim().replaceAll("[\\r\\n]", "") : "";
            targetName = targetName != null ? targetName.trim().replaceAll("[\\r\\n]", "") : "";
            targetApiKey = targetApiKey != null ? targetApiKey.trim().replaceAll("[\\r\\n]", "") : "";

            // 若在 providers 中找到了匹配的 vendor，且当前 apiKey 为空，提取 provider 级别的 apiKey
            if (targetApiKey.isBlank() && providers != null && !targetVendor.isBlank()) {
                for (ProviderConfigData p : providers) {
                    if (targetVendor.equalsIgnoreCase(p.getId()) || targetVendor.equalsIgnoreCase(p.getType())) {
                        if (p.getApiKey() != null && !p.getApiKey().isBlank()) {
                            targetApiKey = p.getApiKey().trim().replaceAll("[\\r\\n]", "");
                            break;
                        }
                    }
                }
            }

            return new ModelSelector(targetVendor, targetName, targetApiKey, temperature, stream);
        }

        /**
         * 从 ModelSelector 构建本地配置数据对象
         *
         * @param selector 模型选择器对象
         * @return ModelConfigData
         */
        public static ModelConfigData fromSelector(ModelSelector selector) {
            return new ModelConfigData(
                    selector != null && selector.vendor() != null ? selector.vendor().trim().replaceAll("[\\r\\n]", "") : "",
                    selector != null && selector.name() != null ? selector.name().trim().replaceAll("[\\r\\n]", "") : "",
                    selector != null && selector.apiKey() != null ? selector.apiKey().trim().replaceAll("[\\r\\n]", "") : "",
                    selector != null && selector.temperature() != null ? selector.temperature() : 0.7,
                    selector != null && selector.stream() != null ? selector.stream() : true
            );
        }
    }

    /**
     * 加载本地配置：
     * 优先读取 ~/.butvan-agent/config.json；
     * 若文件不存在或读取失败，则处理后返回有效配置
     *
     * @return 当前生效的 ModelSelector
     */
    public ModelSelector loadOrInitializeConfig() {
        ModelConfigData fullData = loadFullConfigData();
        return fullData.toSelector();
    }

    /**
     * 读取全量多厂商模型配置数据
     *
     * @return ModelConfigData
     */
    public ModelConfigData loadFullConfigData() {
        File configFile = configPath.toFile();
        if (configFile.exists() && configFile.isFile()) {
            try {
                ModelConfigData data = objectMapper.readValue(configFile, ModelConfigData.class);
                cleanModelConfigData(data);
                log.info("成功从本地文件读取多厂商模型配置: {}", configPath);
                return data;
            } catch (Exception e) {
                log.error("读取本地模型配置文件失败 [{}]", configPath, e);
            }
        }

        // 仅当配置文件不存在时，自动创建并持久化空配置模板；若解析异常则只在内存中返回模板，不破坏已有文件
        ModelConfigData emptyData = new ModelConfigData("", "", "", 0.7, true);
        if (!configFile.exists()) {
            saveFullConfigData(emptyData);
        }
        return emptyData;
    }

    /**
     * 保存全量多厂商模型配置数据到本地配置文件 ~/.butvan-agent/config.json
     *
     * @param fullData 全量模型配置数据
     */
    public synchronized void saveFullConfigData(ModelConfigData fullData) {
        try {
            File configFile = configPath.toFile();
            File parentDir = configFile.getParentFile();
            if (parentDir != null && !parentDir.exists()) {
                parentDir.mkdirs();
            }

            cleanModelConfigData(fullData);

            if (fullData.getVendor() == null || fullData.getVendor().isBlank()) {
                fullData.setVendor(fullData.getActiveVendor());
            }
            if (fullData.getName() == null || fullData.getName().isBlank()) {
                fullData.setName(fullData.getActiveModel());
            }

            objectMapper.writeValue(configFile, fullData);
            log.info("成功保存全量多厂商模型配置至本地文件: {}", configPath);
        } catch (IOException e) {
            log.error("保存全量模型配置到本地文件失败: {}", configPath, e);
        }
    }

    /**
     * 保存最新模型选择器配置到本地配置文件 ~/.butvan-agent/config.json
     * 当初始化页面或模型选择器保存配置时，自动将配置的模型同步追加至 providers 列表中
     *
     * @param selector 需要保存的模型选择器对象
     */
    public synchronized void saveConfig(ModelSelector selector) {
        ModelConfigData fullData = loadFullConfigData();
        if (selector != null && selector.vendor() != null && !selector.vendor().isBlank()) {
            fullData.setVendor(selector.vendor());
            fullData.setName(selector.name());
            fullData.setApiKey(selector.apiKey());
            fullData.setActiveVendor(selector.vendor());
            fullData.setActiveModel(selector.name());

            if (selector.temperature() != null) fullData.setTemperature(selector.temperature());
            if (selector.stream() != null) fullData.setStream(selector.stream());

            // 自动同步/创建到 providers 数组中，确保初始化页面配置的项目即刻出现在模型列表中
            java.util.List<ProviderConfigData> providers = fullData.getProviders();
            if (providers == null) {
                providers = new java.util.ArrayList<>();
                fullData.setProviders(providers);
            }

            String targetVendor = selector.vendor();
            String targetModelName = (selector.name() != null && !selector.name().isBlank()) ? selector.name() : "default-model";

            ProviderConfigData matchingProvider = null;
            for (ProviderConfigData p : providers) {
                if (targetVendor.equalsIgnoreCase(p.getId()) || targetVendor.equalsIgnoreCase(p.getType())) {
                    matchingProvider = p;
                    break;
                }
            }

            if (matchingProvider == null) {
                matchingProvider = new ProviderConfigData(
                        targetVendor,
                        targetVendor.toUpperCase(),
                        targetVendor,
                        selector.apiKey() != null ? selector.apiKey() : "",
                        true,
                        new java.util.ArrayList<>()
                );
                providers.add(matchingProvider);
            } else {
                if (selector.apiKey() != null && !selector.apiKey().isBlank()) {
                    matchingProvider.setApiKey(selector.apiKey());
                }
            }

            // 检查 provider 的 models 列表中是否已包含该模型
            boolean hasModel = false;
            if (matchingProvider.getModels() != null) {
                for (ModelItemData m : matchingProvider.getModels()) {
                    if (targetModelName.equalsIgnoreCase(m.getId()) || targetModelName.equalsIgnoreCase(m.getModelName())) {
                        hasModel = true;
                        break;
                    }
                }
            } else {
                matchingProvider.setModels(new java.util.ArrayList<>());
            }

            if (!hasModel) {
                ModelItemData newItem = new ModelItemData(
                        targetModelName,
                        targetModelName,
                        targetModelName,
                        targetVendor,
                        "",
                        false
                );
                matchingProvider.getModels().add(newItem);
            }
        }
        saveFullConfigData(fullData);
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
