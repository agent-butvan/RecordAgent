package butvan.agent.agents.usage;

/** 通过 AgentScope RuntimeContext 跨异步线程传播的当前对话轮次标识。 */
public record TokenUsageRoundContext(String turnId) {

    public static final String TURN_METADATA_KEY = "butvan_token_usage_turn_id";

    public TokenUsageRoundContext {
        if (turnId == null || turnId.isBlank()) {
            throw new IllegalArgumentException("Token 统计 turnId 不能为空");
        }
    }
}
