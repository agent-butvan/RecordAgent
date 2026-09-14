package butvan.agent.agents.context;

/** 用户可查看和维护的个人上下文状态。 */
public record PersonalContextProfile(
        boolean enabled,
        boolean maintenanceEnabled,
        String content,
        String source,
        int estimatedTokens,
        String revision
) {

    public PersonalContextProfile {
        content = content == null ? "" : content;
        source = source == null ? "explicit" : source;
        estimatedTokens = Math.max(0, estimatedTokens);
        revision = revision == null ? "" : revision;
    }
}
