package butvan.agent.agents.tool.result;

/**
 * 业务工具统一返回结构。
 *
 * @param success 是否成功
 * @param summary 供 Agent 与用户快速理解的结果摘要
 * @param data 成功时的结构化数据
 * @param error 失败时的稳定错误
 */
public record ToolResult<T>(boolean success, String summary, T data, ToolError error) {

    public static <T> ToolResult<T> success(String summary, T data) {
        return new ToolResult<>(true, summary, data, null);
    }

    public static ToolResult<Void> failure(String code, String message) {
        return new ToolResult<>(false, message, null, new ToolError(code, message));
    }
}
