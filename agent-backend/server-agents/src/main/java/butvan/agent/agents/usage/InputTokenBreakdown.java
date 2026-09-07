package butvan.agent.agents.usage;

/** 一次或一轮模型输入的本地估算构成；只有 actual Input 来自供应商。 */
public record InputTokenBreakdown(
        long systemPromptTokens,
        long historyTokens,
        long currentUserTokens,
        long toolSchemaTokens,
        long toolResultTokens,
        long ragContextTokens,
        long otherTokens
) {

    public InputTokenBreakdown {
        systemPromptTokens = nonNegative(systemPromptTokens);
        historyTokens = nonNegative(historyTokens);
        currentUserTokens = nonNegative(currentUserTokens);
        toolSchemaTokens = nonNegative(toolSchemaTokens);
        toolResultTokens = nonNegative(toolResultTokens);
        ragContextTokens = nonNegative(ragContextTokens);
        otherTokens = nonNegative(otherTokens);
    }

    public static InputTokenBreakdown empty() {
        return new InputTokenBreakdown(0, 0, 0, 0, 0, 0, 0);
    }

    /** 不含 Provider 协议差值的可解释输入估算。 */
    public long estimatedTokens() {
        return systemPromptTokens + historyTokens + currentUserTokens + toolSchemaTokens
                + toolResultTokens + ragContextTokens;
    }

    public InputTokenBreakdown withOtherTokens(long value) {
        return new InputTokenBreakdown(
                systemPromptTokens, historyTokens, currentUserTokens, toolSchemaTokens,
                toolResultTokens, ragContextTokens, value);
    }

    public InputTokenBreakdown plus(InputTokenBreakdown other) {
        if (other == null) return this;
        return new InputTokenBreakdown(
                systemPromptTokens + other.systemPromptTokens,
                historyTokens + other.historyTokens,
                currentUserTokens + other.currentUserTokens,
                toolSchemaTokens + other.toolSchemaTokens,
                toolResultTokens + other.toolResultTokens,
                ragContextTokens + other.ragContextTokens,
                otherTokens + other.otherTokens);
    }

    private static long nonNegative(long value) {
        return Math.max(0, value);
    }
}
