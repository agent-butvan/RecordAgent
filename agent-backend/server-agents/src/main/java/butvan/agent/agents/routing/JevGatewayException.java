package butvan.agent.agents.routing;

/** 表示 TypeSafe System One 调用或响应校验失败。 */
public class JevGatewayException extends RuntimeException {

    /**
     * 创建不携带底层原因的网关异常。
     *
     * @param message 可安全写入内部日志的错误摘要；不得包含 Key 或用户原文
     */
    public JevGatewayException(String message) {
        super(message);
    }

    /**
     * 创建保留底层原因的网关异常。
     *
     * @param message 可安全写入内部日志的错误摘要；不得包含 Key 或用户原文
     * @param cause RestClient 抛出的原始异常，仅用于内部诊断
     */
    public JevGatewayException(String message, Throwable cause) {
        super(message, cause);
    }
}