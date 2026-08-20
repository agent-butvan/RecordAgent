package butvan.agent.agents.config;

import butvan.agent.agents.model.ModelSelector;
import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import lombok.AccessLevel;
import lombok.Data;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.Map;

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

        /**
         * 配置文件中的未知顶层节点（例如后续新增的 feishu 渠道配置）。
         *
         * <p>读取时原样收进此集合，保存时原样写回，避免模型配置保存覆盖时
         * 把其他模块写入 config.json 的配置丢掉。</p>
         */
        @Getter(AccessLevel.NONE)
        private Map<String, Object> extraFields = new LinkedHashMap<>();

        /**
         * 未知顶层节点读取入口。
         *
         * @return 额外顶层节点
         */
        @JsonAnyGetter
        public Map<String, Object> getExtraFields() {
            return extraFields != null ? extraFields : Map.of();
        }

        /**
         * 未知顶层节点写入入口。
         *
         * @param key   顶层节点名
         * @param value 节点内容
         */
        @JsonAnySetter
        public void setExtraField(String key, Object value) {
            if (extraFields == null) {
                extraFields = new LinkedHashMap<>();
            }
            extraFields.put(key, value);
        }

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

            // 若在 providers 中找到了匹配的 vendor，且当前 apiKey 为空，提取 provider 级别的 apiKey
            if ((targetApiKey == null || targetApiKey.isBlank()) && providers != null && targetVendor != null) {
                for (ProviderConfigData p : providers) {
                    if (targetVendor.equalsIgnoreCase(p.getId()) || targetVendor.equalsIgnoreCase(p.getType())) {
                        if (p.getApiKey() != null && !p.getApiKey().isBlank()) {
                            targetApiKey = p.getApiKey();
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
                log.info("成功从本地文件读取多厂商模型配置: {}", configPath);
                return data;
            } catch (Exception e) {
                log.error("读取本地模型配置文件失败 [{}]，将自动初始化为空配置模板并写出", configPath, e);
            }
        }

        // 文件不存在或读取异常：自动创建配置模板
        ModelConfigData emptyData = new ModelConfigData("", "", "", 0.7, true);
        saveFullConfigData(emptyData);
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

            // 合并写入：避免空 payload（例如前端 localStorage 为空时的挂载写回）整体覆盖本地已有配置。
            if (configFile.exists() && configFile.isFile()) {
                ModelConfigData existing = null;
                try {
                    existing = objectMapper.readValue(configFile, ModelConfigData.class);
                } catch (Exception readEx) {
                    log.warn("合并写入前读取本地配置失败，按空配置处理: {}", configPath, readEx);
                }

                if (existing != null) {
                    if (isBlank(fullData.getVendor())) {
                        fullData.setVendor(existing.getVendor());
                    }
                    if (isBlank(fullData.getName())) {
                        fullData.setName(existing.getName());
                    }
                    if (isBlank(fullData.getApiKey())) {
                        fullData.setApiKey(existing.getApiKey());
                    }
                    if (isBlank(fullData.getActiveVendor())) {
                        fullData.setActiveVendor(existing.getActiveVendor());
                    }
                    if (isBlank(fullData.getActiveModel())) {
                        fullData.setActiveModel(existing.getActiveModel());
                    }
                    if (fullData.getTemperature() == null) {
                        fullData.setTemperature(existing.getTemperature());
                    }
                    if (fullData.getStream() == null) {
                        fullData.setStream(existing.getStream());
                    }
                    if ((fullData.getProviders() == null || fullData.getProviders().isEmpty())
                            && existing.getProviders() != null && !existing.getProviders().isEmpty()) {
                        log.warn("收到空 providers 写回，保留本地已有 {} 个模型配置，防止配置被清空",
                                existing.getProviders().size());
                        fullData.setProviders(existing.getProviders());
                    }
                    // 保留未知顶层节点（如 feishu 等渠道配置），避免被前端整包覆盖丢掉
                    existing.getExtraFields().forEach(fullData::setExtraField);
                }
            }

            objectMapper.writeValue(configFile, fullData);
            log.info("成功保存全量多厂商模型配置至本地文件: {}", configPath);
        } catch (IOException e) {
            log.error("保存全量模型配置到本地文件失败: {}", configPath, e);
        }
    }

    /**
     * 判断字符串为空或全空白。
     */
    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
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
