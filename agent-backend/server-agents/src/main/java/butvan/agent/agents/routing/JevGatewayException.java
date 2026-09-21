package butvan.agent.agents.routing;

/** 表示 TypeSafe System One 调用或响应校验失败。 */
public class JevGatewayException extends RuntimeException {

    /** 可安全传播给路由决策与前端的失败摘要。 */
    private final ToolRoutingFailure failure;

    /** TypeSafe 返回的尽力解析提示；不得未经脱敏直接写入日志或前端。 */
    private final String providerMessage;

    /**
     * 创建不携带底层原因的网关异常。
     *
     * @param message 可安全写入内部日志的错误摘要；不得包含 Key 或用户原文
     */
    public JevGatewayException(String message) {
        this(ToolRoutingFailure.invalidResponse(null), message, null);
    }

    /**
     * 创建保留底层原因的网关异常。
     *
     * @param message 可安全写入内部日志的错误摘要；不得包含 Key 或用户原文
     * @param cause RestClient 抛出的原始异常，仅用于内部诊断
     */
    public JevGatewayException(String message, Throwable cause) {
        this(ToolRoutingFailure.invalidResponse(null), message, cause);
    }

    /**
     * 创建携带结构化失败信息的网关异常。
     *
     * @param failure 可安全传播的失败摘要
     * @param providerMessage 供应商返回的提示，仅供受控诊断
     * @param cause 底层异常
     */
    public JevGatewayException(
            ToolRoutingFailure failure,
            String providerMessage,
            Throwable cause
    ) {
        super(failure == null ? "Jev 请求失败" : failure.message(), cause);
        this.failure = failure == null ? ToolRoutingFailure.unknown() : failure;
        this.providerMessage = providerMessage == null ? "" : providerMessage;
    }

    /** @return 可安全传播的结构化失败摘要 */
    public ToolRoutingFailure failure() {
        return failure;
    }

    /** @return TypeSafe 返回的尽力解析提示，不得直接展示 */
    public String providerMessage() {
        return providerMessage;
    }
}
