package butvan.agent.agents.routing;

import java.util.Map;

/**
 * System One HTTP 请求体。
 *
 * @param state 本次需要判断的用户文本
 * @param model Jev 模型名称或别名
 * @param questions 以能力组名为键的 Noul 问题
 */
public record JevSystemOneRequest(
        String state,
        String model,
        Map<String, JevNoulQuestion> questions
) {
}
