package butvan.agent.agents.context;

import java.util.List;

/** 发送给画像提案生成 adapter 的有界输入。 */
public record ProfileGenerationRequest(
        String currentProfile,
        List<MemoryEvidence> evidence
) {

    public ProfileGenerationRequest {
        currentProfile = currentProfile == null ? "" : currentProfile;
        evidence = evidence == null ? List.of() : List.copyOf(evidence);
    }

    /** 一段带稳定来源 ID 的候选记忆。 */
    public record MemoryEvidence(String sourceId, String content) {
        public MemoryEvidence {
            if (sourceId == null || sourceId.isBlank()) throw new IllegalArgumentException("记忆来源不能为空");
            sourceId = sourceId.strip();
            content = content == null ? "" : content.strip();
        }
    }
}
