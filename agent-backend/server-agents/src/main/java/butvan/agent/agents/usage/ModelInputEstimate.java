package butvan.agent.agents.usage;

import java.util.List;

/** Model Call 发出前，对最终逻辑输入做出的不可变估算快照。 */
public record ModelInputEstimate(
        String counterId,
        InputTokenBreakdown breakdown,
        List<ToolTokenUsage> toolUsages
) {
    public ModelInputEstimate {
        counterId = counterId == null || counterId.isBlank() ? "unknown" : counterId;
        breakdown = breakdown == null ? InputTokenBreakdown.empty() : breakdown;
        toolUsages = toolUsages == null ? List.of() : List.copyOf(toolUsages);
    }
}
