package butvan.agent.agents.context;

/** 用户可查看和维护的个人上下文状态。 */
public record PersonalContextProfile(
        boolean enabled,
        String content,
        String source,
        int estimatedTokens
) {

    public PersonalContextProfile {
        content = content == null ? "" : content;
        source = source == null ? "explicit" : source;
        estimatedTokens = Math.max(0, estimatedTokens);
    }
}
