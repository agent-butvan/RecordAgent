package butvan.agent.network.dto;

/**
 * 桌面端展示后台子 Agent 任务状态的响应对象。
 *
 * @param taskId 任务标识
 * @param status 当前任务状态
 * @param result 已完成任务的结果
 * @param error 已失败任务的错误信息
 */
public record SubagentTaskResponse(String taskId, String status, String result, String error) {
}
