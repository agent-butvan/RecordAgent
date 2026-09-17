package butvan.agent.agents.agent.run;

import butvan.agent.agents.storage.AgentStorageProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;

/** 管理运行中轮次检查点，使用单轮次文件和原子替换避免产生半份 JSON。 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentRunCheckpointService {

    private final AgentStorageProperties storageProperties;
    private final ObjectMapper objectMapper;

    /** 保存当前运行态快照。 */
    public synchronized void save(AgentRun run) {
        save(run.checkpoint());
    }

    /** 保存显式快照，供恢复测试和后续迁移复用。 */
    public synchronized void save(AgentRunCheckpoint checkpoint) {
        Path target = storageProperties.runCheckpointFile(checkpoint.turnId());
        Path temporary = target.resolveSibling(target.getFileName() + ".tmp");
        try {
            objectMapper.writeValue(temporary.toFile(), checkpoint);
            moveReplacing(temporary, target);
        } catch (IOException exception) {
            throw new IllegalArgumentException("写入 Agent 运行检查点失败", exception);
        }
    }

    /** 读取全部有效检查点；单个损坏文件不会阻断其他轮次恢复。 */
    public synchronized List<AgentRunCheckpoint> list() {
        List<AgentRunCheckpoint> checkpoints = new ArrayList<>();
        try (var files = Files.list(storageProperties.getRunCheckpointDirectory())) {
            files.filter(path -> path.getFileName().toString().endsWith(".json"))
                    .sorted()
                    .forEach(path -> read(path, checkpoints));
            return List.copyOf(checkpoints);
        } catch (IOException exception) {
            throw new IllegalArgumentException("读取 Agent 运行检查点失败", exception);
        }
    }

    /** 删除已完成或无需恢复的轮次检查点。 */
    public synchronized void delete(String turnId) {
        try {
            Files.deleteIfExists(storageProperties.runCheckpointFile(turnId));
        } catch (IOException exception) {
            throw new IllegalArgumentException("删除 Agent 运行检查点失败", exception);
        }
    }

    /** 删除指定会话的全部运行中检查点。 */
    public synchronized void deleteSession(String sessionId) {
        list().stream()
                .filter(checkpoint -> java.util.Objects.equals(checkpoint.sessionId(), sessionId))
                .forEach(checkpoint -> delete(checkpoint.turnId()));
    }

    private void read(Path path, List<AgentRunCheckpoint> checkpoints) {
        try {
            checkpoints.add(objectMapper.readValue(path.toFile(), AgentRunCheckpoint.class));
        } catch (IOException exception) {
            log.warn("跳过损坏的 Agent 运行检查点：file={}", path.getFileName());
        }
    }

    private void moveReplacing(Path source, Path target) throws IOException {
        try {
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (AtomicMoveNotSupportedException exception) {
            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }
}
