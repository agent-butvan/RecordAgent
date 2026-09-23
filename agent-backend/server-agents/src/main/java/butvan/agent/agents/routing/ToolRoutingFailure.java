package butvan.agent.agents.routing;

/**
 * Jev 路由失败后可安全传播到日志与前端的结构化摘要。
 *
 * @param code 稳定错误分类
 * @param httpStatus HTTP 状态码；网络层失败时为空
 * @param requestId TypeSafe 请求 ID；响应未携带时为空字符串
 * @param retryAfterMillis 服务端建议等待毫秒数；未提供时为空
 * @param message 可直接展示给用户的脱敏中文提示
 * @param retryable 当前错误类型是否适合重试
 */
public record ToolRoutingFailure(
        Code code,
        Integer httpStatus,
        String requestId,
        Long retryAfterMillis,
        String message,
        boolean retryable
) {

    /** 归一化可空字段，避免 SSE payload 出现不稳定的 null 文本。 */
    public ToolRoutingFailure {
        code = code == null ? Code.UNKNOWN : code;
        requestId = requestId == null ? "" : requestId.strip();
        message = message == null || message.isBlank()
                ? "Jev 暂不可用，已使用本地工具路由。"
                : message.strip();
    }

    /** 创建 Jev 响应无法通过本地契约校验时的失败摘要。 */
    public static ToolRoutingFailure invalidResponse(String message) {
        return new ToolRoutingFailure(
                Code.INVALID_RESPONSE,
                null,
                "",
                null,
                message == null || message.isBlank()
                        ? "Jev 响应格式异常，已使用本地工具路由。"
                        : message,
                false
        );
    }

    /** 创建无法进一步分类时的安全降级摘要。 */
    public static ToolRoutingFailure unknown() {
        return new ToolRoutingFailure(
                Code.UNKNOWN,
                null,
                "",
                null,
                "Jev 暂不可用，已使用本地工具路由。",
                false
        );
    }

    /** 前后端共同使用的稳定错误分类。 */
    public enum Code {
        AUTHENTICATION,
        PERMISSION,
        INVALID_REQUEST,
        RATE_LIMIT,
        OVERLOADED,
        SERVER_ERROR,
        TIMEOUT,
        NETWORK,
        INVALID_RESPONSE,
        UNKNOWN;

        /** @return SSE 中使用的小写错误码 */
        public String payloadValue() {
            return name().toLowerCase(java.util.Locale.ROOT);
        }
    }
}
