package butvan.agent.agents.usage;

/** 某个工具在一次模型调用或一轮对话中占用的输入 Token 估算。 */
public record ToolTokenUsage(String toolName, long schemaTokens, long resultTokens) {

    public ToolTokenUsage {
        toolName = toolName == null || toolName.isBlank() ? "unknown-tool" : toolName.strip();
        schemaTokens = Math.max(0, schemaTokens);
        resultTokens = Math.max(0, resultTokens);
    }

    public ToolTokenUsage plus(ToolTokenUsage other) {
        if (other == null) return this;
        if (!toolName.equals(other.toolName)) {
            throw new IllegalArgumentException("只能合并同名工具的 Token 用量");
        }
        return new ToolTokenUsage(toolName, schemaTokens + other.schemaTokens,
                resultTokens + other.resultTokens);
    }
}
