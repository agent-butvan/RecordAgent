package butvan.agent.network.dto;

/**
 * 计划书读取响应。
 *
 * @param content 计划书 markdown 内容
 */
public record PlanResponse(String content) {
}