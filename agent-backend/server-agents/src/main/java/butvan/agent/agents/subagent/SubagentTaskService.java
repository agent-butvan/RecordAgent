package butvan.agent.agents.subagent;

import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.harness.agent.subagent.task.BackgroundTask;
import io.agentscope.harness.agent.subagent.task.TaskRepository;
import io.agentscope.harness.agent.subagent.task.TaskStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 后台子 Agent 任务的查询与取消（供 Controller 层使用）。
 */
@Service
@RequiredArgsConstructor
public class SubagentTaskService {

    private final TaskRepository taskRepository;

    public List<BackgroundTask> list(String userId, String sessionId) {
        return List.copyOf(taskRepository.listTasks(
                RuntimeContext.builder().userId(userId).sessionId(sessionId).build(),
                sessionId, null));
    }

    public BackgroundTask get(String userId, String sessionId, String taskId) {
        return taskRepository.getTask(
                RuntimeContext.builder().userId(userId).sessionId(sessionId).build(),
                sessionId, taskId);
    }

    public boolean cancel(String userId, String sessionId, String taskId) {
        return taskRepository.cancelTask(
                RuntimeContext.builder().userId(userId).sessionId(sessionId).build(),
                sessionId, taskId);
    }

    public boolean isTerminal(BackgroundTask task) {
        TaskStatus status = task.getTaskStatus();
        return status != null && status.isTerminal();
    }
}
