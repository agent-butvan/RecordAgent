package butvan.agent.agents.config;

import butvan.agent.agents.routing.ToolRoutingMode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
}
