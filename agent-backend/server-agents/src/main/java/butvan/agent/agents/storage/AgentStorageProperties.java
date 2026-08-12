package butvan.agent.agents.storage;

import lombok.Getter;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * ButvanAgent 本地持久化目录的唯一入口。
 *
 * <p>所有服务都通过本类获取路径，禁止在其他类中手工拼接用户目录、
 * sessionDir 或 .agentscope 路径。</p>
 */
@Getter
@Component
public class AgentStorageProperties {

    /** ButvanAgent 的用户数据根目录，例如 /Users/xxx/.butvan-agent。 */
    private final Path rootDirectory;

    /** 保存侧边栏会话摘要的目录册文件。 */
    private final Path sessionCatalogFile;

    /** 保存用户可见消息记录的目录。 */
    private final Path transcriptDirectory;

    /** AgentScope AgentStateStore 的根目录。 */
    private final Path agentStateDirectory;

    /** AgentScope Workspace 的根目录。 */
    private final Path workspaceDirectory;

    public AgentStorageProperties() {
        rootDirectory = Paths.get(System.getProperty("user.home"), "butvan-agent");
        sessionCatalogFile = rootDirectory.resolve("sessions").resolve("catalog.json");
        transcriptDirectory = rootDirectory.resolve("transcripts");
        agentStateDirectory = rootDirectory.resolve("agentscope").resolve("state");
        workspaceDirectory = rootDirectory.resolve("agentscope").resolve("workspace");

        // 应用启动的时候创建本项目明确拥有的目录
        createDirectories(sessionCatalogFile.getParent());
        createDirectories(transcriptDirectory);
        createDirectories(agentStateDirectory);
        createDirectories(workspaceDirectory);
    }

    /**
     * 根据受后端控制的 UUID 得到该会话的消息文件
     * @param sessionId
     * @return
     */
    public Path transcriptFile(String sessionId) {
        if (sessionId == null || !sessionId.matches("[a-zA-Z0-9-]+")) {
            throw new IllegalArgumentException("会话ID 格式非法");
        }

        return transcriptDirectory.resolve(sessionId + ".jsonl");
    }

    private void createDirectories(Path directory) {
        try {
            Files.createDirectories(directory);
        } catch (IOException e) {
            throw new IllegalArgumentException("无法初始化本地数据目录:" + directory, e);
        }
    }
}
