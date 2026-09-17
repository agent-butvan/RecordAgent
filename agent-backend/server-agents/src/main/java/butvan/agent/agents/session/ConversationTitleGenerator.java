package butvan.agent.agents.session;

/** 根据首个用户问题生成简短会话标题的模型端口。 */
public interface ConversationTitleGenerator {

    /**
     * 生成不带引号、序号或解释的标题。
     *
     * @param sessionId 会话 ID，用于独立归集标题调用用量
     * @param firstQuestion 会话首个用户问题
     * @return 模型生成的候选标题
     */
    String generate(String sessionId, String firstQuestion);
}
