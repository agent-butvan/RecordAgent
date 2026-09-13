package butvan.agent.network.context.dto;

import butvan.agent.agents.context.PersonalContextProfile;
import butvan.agent.agents.context.ContextRequest;
import butvan.agent.agents.context.PersonalContextService;

/** 个人上下文 HTTP 输入输出对象。 */
public final class PersonalContextDtos {

    private PersonalContextDtos() {
    }

    /** 设置页所需的个人上下文状态与硬预算。 */
    public record Response(
            boolean enabled,
            String profile,
            String source,
            int estimatedTokens,
            int profileTokenBudget,
            int memoryTokenBudget,
            int totalTokenBudget,
            int maxProfileChars
    ) {
    }

    /** 更新显式个人画像。 */
    public record UpdateProfileRequest(String profile) {
    }

    /** 开启或暂停自动注入。 */
    public record UpdateEnabledRequest(boolean enabled) {
    }

    /** 将领域状态映射为稳定的网络响应。 */
    public static Response from(PersonalContextProfile profile) {
        return new Response(profile.enabled(), profile.content(), profile.source(),
                profile.estimatedTokens(), ContextRequest.DEFAULT_PROFILE_BUDGET,
                ContextRequest.DEFAULT_MEMORY_BUDGET,
                ContextRequest.DEFAULT_TOTAL_BUDGET,
                PersonalContextService.MAX_PROFILE_CHARS);
    }
}
