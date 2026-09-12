package butvan.agent.network.chat.dto;

/** AI 分析命令请求；业务数据始终由服务端按用户身份读取。 */
public record AgentAnalysisContextRequest(
        String command,
        String argument,
        String timezone,
        boolean privacyConfirmed) {
}
