package butvan.agent.feishu.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * 飞书渠道配置读取服务。
 *
 * <p>只从本地 {@code ~/.butvan-agent/config.json} 的 feishu 节点读取配置，
 * 禁止把 App Secret 写入 yml、源码或日志。</p>
 */
@Slf4j
@Component
public class FeishuProperties {

    private static final Path CONFIG_PATH =
            Paths.get(System.getProperty("user.home"), ".butvan-agent", "config.json");

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 读取当前生效的飞书配置；文件缺失、节点缺失或解析失败时返回禁用状态。
     *
     * @return 飞书配置
     */
    public FeishuConfigData load() {
        try {
            if (!Files.isRegularFile(CONFIG_PATH)) {
                return FeishuConfigData.disabled();
            }
            JsonNode root = objectMapper.readTree(CONFIG_PATH.toFile());
            JsonNode feishu = root.path("feishu");
            if (feishu.isMissingNode() || feishu.isNull()) {
                return FeishuConfigData.disabled();
            }
            return new FeishuConfigData(
                    feishu.path("enabled").asBoolean(false),
                    feishu.path("appId").asText(""),
                    feishu.path("appSecret").asText("")
            );
        } catch (IOException e) {
            log.error("读取本地飞书配置失败，飞书机器人将保持禁用：{}", CONFIG_PATH, e);
            return FeishuConfigData.disabled();
        }
    }
}
