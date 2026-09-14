package butvan.agent.agents.context;

/** 在模型 seam 上把有界记忆转换为结构化画像候选。 */
public interface ProfileProposalGenerator {

    ProfileGenerationResult generate(ProfileGenerationRequest request);
}
