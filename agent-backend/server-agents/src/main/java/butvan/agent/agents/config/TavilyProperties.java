package butvan.agent.agents.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Tavily 搜索配置读取服务。
 *
 * <p>只从本地 {@code ~/.butvan-agent/config.json} 的 webSearch 节点读取配置，
 * 禁止把 API Key 写入 yml、源码或日志。</p>
 */
@Slf4j
@Data
@Component
public class TavilyProperties {

    private static final Path CONFIG_PATH = Paths.get(System.getProperty("user.home"), ".butvan-agent", "config.json");

    private final ObjectMapper objectMapper = new ObjectMapper();

    public TavilyConfigData load() {
        try {
            // 文件不存在时直接返回禁用态，不算错误
            if (!Files.isRegularFile(CONFIG_PATH)) {
                return TavilyConfigData.disabled();
            }

            // 解析整个JSON文件，再定位 webSearch 节点
            JsonNode root = objectMapper.readTree(CONFIG_PATH.toFile());
            JsonNode webSearch = root.path("webSearch");

            // 节点缺失时同样返回禁用态
            if (webSearch.isMissingNode() || webSearch.isNull()) {
                return TavilyConfigData.disabled();
            }

            return new TavilyConfigData(
                    webSearch.path("enabled").asBoolean(false),
                    webSearch.path("apiKey").asText(""),
                    webSearch.path("maxResults").asInt(5),
                    webSearch.path("searchDepth").asText("basic")
            );
        } catch (IOException e) {
            // 只记录文件路径，绝不记录 key 内容
            log.error("读取本地 Tavily 配置失败，联网搜索将保持禁用：{}",CONFIG_PATH, e);
            return TavilyConfigData.disabled();
        }
    }
}
