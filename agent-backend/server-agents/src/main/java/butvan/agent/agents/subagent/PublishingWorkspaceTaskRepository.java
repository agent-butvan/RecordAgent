package butvan.agent.agents.subagent;

import butvan.agent.agents.subagent.event.SubagentTaskLifecycleEvent;
import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.harness.agent.subagent.task.BackgroundTask;
import io.agentscope.harness.agent.subagent.task.TaskRunSpec;
import io.agentscope.harness.agent.subagent.task.WorkspaceTaskRepository;
import io.agentscope.harness.agent.workspace.WorkspaceManager;
import org.springframework.context.ApplicationEventPublisher;

/**
 * 在保留 AgentScope 原生任务完成回调能力的前提下，发布任务生命周期事件。
 *
 * <p>必须继承 {@link WorkspaceTaskRepository}，因为 AgentScope 通过该具体类型注册其
 * 任务完成回调；以普通装饰器替换会破坏后台结果回注主 Agent 的既有流程。</p>
 */
public class PublishingWorkspaceTaskRepository extends WorkspaceTaskRepository {

    private static final long COMPLETION_WAIT_MILLIS = 30_000L;

    private final ApplicationEventPublisher eventPublisher;

    public PublishingWorkspaceTaskRepository(
            WorkspaceManager workspaceManager, String parentAgentId, ApplicationEventPublisher eventPublisher) {
        super(workspaceManager, parentAgentId);
        this.eventPublisher = eventPublisher;
    }

    @Override
    public BackgroundTask putTask(
            RuntimeContext runtimeContext,
            String taskId,
            String subAgentId,
            String sessionId,
            TaskRunSpec taskRunSpec) {
        BackgroundTask task = super.putTask(runtimeContext, taskId, subAgentId, sessionId, taskRunSpec);
        publish(runtimeContext, sessionId, task);
        observeCompletion(runtimeContext, sessionId, task);
        return task;
    }

    @Override
    public boolean cancelTask(RuntimeContext runtimeContext, String sessionId, String taskId) {
        boolean cancelled = super.cancelTask(runtimeContext, sessionId, taskId);
        BackgroundTask task = super.getTask(runtimeContext, sessionId, taskId);
        if (task != null) {
            publish(runtimeContext, sessionId, task);
        }
        return cancelled;
    }

    /** 任务完成由 Future 唤醒，不以定时查询任务列表的方式检测状态。 */
    private void observeCompletion(RuntimeContext runtimeContext, String sessionId, BackgroundTask task) {
        Thread.startVirtualThread(() -> {
            try {
                while (!task.waitForCompletion(COMPLETION_WAIT_MILLIS)) {
                    // 仅等待底层 Future；超时后继续等待以应对极长任务。
                }
                publish(runtimeContext, sessionId, task);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            }
        });
    }

    private void publish(RuntimeContext runtimeContext, String sessionId, BackgroundTask task) {
        Exception exception = task.getError();
        eventPublisher.publishEvent(new SubagentTaskLifecycleEvent(
                runtimeContext == null ? "" : runtimeContext.getUserId(),
                sessionId == null ? "" : sessionId,
                task.getTaskId(),
                String.valueOf(task.getTaskStatus()),
                task.getResult() == null ? "" : task.getResult(),
                exception == null || exception.getMessage() == null ? "" : exception.getMessage()));
    }
}
