package butvan.agent.agents.context;

import java.time.Instant;
import java.util.List;

/** 等待用户确认的一份完整画像修改提案。 */
public record ProfileProposal(
        String id,
        String baseRevision,
        String memoryFingerprint,
        Instant createdAt,
        String summary,
        String proposedProfile,
        List<ProfileChange> changes
) {

    public ProfileProposal {
        id = required(id, "提案 ID");
        baseRevision = required(baseRevision, "基础 revision");
        memoryFingerprint = required(memoryFingerprint, "记忆指纹");
        createdAt = createdAt == null ? Instant.now() : createdAt;
        summary = summary == null ? "" : summary.strip();
        proposedProfile = proposedProfile == null ? "" : proposedProfile.strip();
        changes = changes == null ? List.of() : List.copyOf(changes);
    }

    private static String required(String value, String label) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(label + "不能为空");
        return value.strip();
    }
}
