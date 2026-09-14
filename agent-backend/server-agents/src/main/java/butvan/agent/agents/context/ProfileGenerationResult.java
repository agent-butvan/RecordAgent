package butvan.agent.agents.context;

import java.util.List;

/** 模型生成的画像候选结果，尚未通过领域校验。 */
public record ProfileGenerationResult(
        String summary,
        String proposedProfile,
        List<ProfileChange> changes
) {

    public ProfileGenerationResult {
        summary = summary == null ? "" : summary.strip();
        proposedProfile = proposedProfile == null ? "" : proposedProfile.strip();
        changes = changes == null ? List.of() : List.copyOf(changes);
    }
}
