package butvan.agent.agents.subagent.event;

/**
 * 后台子 Agent 任务状态变化事件。
 *
 * <p>该事件只携带可安全发送给桌面端的任务快照，不暴露 AgentScope 的运行时对象。</p>
 *
 * @param userId 当前用户标识
 * @param sessionId 父会话标识
 * @param taskId 后台任务标识
 * @param status 当前任务状态
 * @param result 任务结果（未完成时为空）
 * @param error 任务错误（未失败时为空）
 */
public record SubagentTaskLifecycleEvent(
        String userId,
        String sessionId,
        String taskId,
        String status,
        String result,
        String error
) {
}
