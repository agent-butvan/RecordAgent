package butvan.agent.agents.usage;

/** 模型调用的业务用途，避免将后台调用混入聊天轮次。 */
public enum UsagePurpose {
    CHAT,
    SESSION_TITLE,
    PROFILE_MAINTENANCE,
    CONTEXT_COMPACTION,
    BACKGROUND_AGENT
}
