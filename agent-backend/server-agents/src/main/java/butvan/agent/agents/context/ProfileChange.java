package butvan.agent.agents.context;

import java.util.List;

/** 一项可解释的画像变更及其记忆依据。 */
public record ProfileChange(
        ProfileChangeOperation operation,
        String section,
        String before,
        String after,
        String reason,
        List<String> sourceIds,
        double confidence
) {

    public ProfileChange {
        if (operation == null) throw new IllegalArgumentException("画像变更类型不能为空");
        section = normalize(section);
        before = normalize(before);
        after = normalize(after);
        reason = normalize(reason);
        sourceIds = sourceIds == null ? List.of() : sourceIds.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(String::strip).distinct().limit(8).toList();
        confidence = Double.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.strip();
    }
}
