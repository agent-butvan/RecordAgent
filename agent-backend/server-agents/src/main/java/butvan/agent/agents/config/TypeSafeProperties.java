package butvan.agent.agents.config;

import butvan.agent.agents.routing.ToolRoutingMode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/** 从用户级 config.json 动态读取 TypeSafe Jev 配置。 */
@Slf4j
@Component
public class TypeSafeProperties {

    /** DEFAULT_CONFIG_PATH：ButvanAgent 用户级配置文件的默认位置。 */
    private static final Path DEFAULT_CONFIG_PATH = Paths.get(
            System.getProperty("user.home"), ".butvan-agent", "config.json");

    /** objectMapper：负责解析本地 JSON 配置文件的 Jackson 组件。 */
    private final ObjectMapper objectMapper;

    /** configPath：当前实例读取的配置文件位置；测试可注入临时路径。 */
    private final Path configPath;

    /**
     * 创建生产环境配置读取器。
     *
     * @param objectMapper Spring 统一配置的 JSON 解析器
     */
    @Autowired
    public TypeSafeProperties(ObjectMapper objectMapper) {
        this(objectMapper, DEFAULT_CONFIG_PATH);
    }

    /** 测试专用构造器，允许使用临时配置文件。 */
    TypeSafeProperties(ObjectMapper objectMapper, Path configPath) {
        this.objectMapper = objectMapper;
        this.configPath = configPath;
    }

    /**
     * 每次路由前读取最新的 TypeSafe 配置。
     *
     * @return 有效配置；文件缺失、节点缺失或读取失败时返回关闭态
     */
    public TypeSafeConfigData load() {
        try {
            if (!Files.isRegularFile(configPath)) return TypeSafeConfigData.disabled();

            // node：config.json 根对象中的 typesafe 配置节点。
            JsonNode node = objectMapper.readTree(configPath.toFile()).path("typesafe");
            if (node.isMissingNode() || node.isNull()) return TypeSafeConfigData.disabled();

            // threshold：Noul 概率达到该值时，能力组才会被选中。
            double threshold = node.path("threshold").asDouble(0.75);
            if (!Double.isFinite(threshold) || threshold < 0.0 || threshold > 1.0) {
                threshold = 0.75;
            }

            String model = node.path("model").asText("jev-latest").strip();
            if (model.isEmpty()) model = "jev-latest";

            return new TypeSafeConfigData(
                    node.path("enabled").asBoolean(false),
                    ToolRoutingMode.parse(node.path("mode").asText("off")),
                    node.path("apiKey").asText(""),
                    model,
                    threshold
            );
        } catch (IOException | RuntimeException exception) {
            // exception：读取或解析本地配置时发生的异常；禁止记录配置内容。
            log.error("读取 TypeSafe 配置失败，Jev 路由将保持关闭：{}", configPath, exception);
            return TypeSafeConfigData.disabled();
        }
    }

    /**
     * 更新 Jev 总开关，同时保留 config.json 中的其他配置节点。
     *
     * @param enabled 是否开启 Jev 路由
     * @return 更新后的脱敏配置快照
     */
    public synchronized TypeSafeConfigData updateEnabled(boolean enabled) {
        TypeSafeConfigData current = load();
        if (enabled && !current.isConfigured()) {
            throw new IllegalArgumentException("Jev 尚未完成配置，请先设置有效的模式、API Key 与模型");
        }

        try {
            ObjectNode root = readConfigRoot();
            JsonNode existingNode = root.get("typesafe");
            ObjectNode typeSafeNode = existingNode instanceof ObjectNode objectNode
                    ? objectNode
                    : objectMapper.createObjectNode();
            typeSafeNode.put("enabled", enabled);
            root.set("typesafe", typeSafeNode);

            Path parent = configPath.getParent();
            if (parent != null) Files.createDirectories(parent);
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(configPath.toFile(), root);
            return load();
        } catch (IOException exception) {
            log.error("更新 Jev 开关失败：{}", configPath, exception);
            throw new IllegalStateException("Jev 开关保存失败", exception);
        }
    }

    /** 读取配置根对象；文件不存在时返回空对象，格式异常时拒绝覆盖。 */
    private ObjectNode readConfigRoot() throws IOException {
        if (!Files.isRegularFile(configPath)) return objectMapper.createObjectNode();
        JsonNode root = objectMapper.readTree(configPath.toFile());
        if (root instanceof ObjectNode objectNode) return objectNode;
        throw new IOException("config.json 根节点不是对象");
    }
}
