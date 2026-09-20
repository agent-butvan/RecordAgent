package butvan.agent.agents.routing;

import java.util.Map;

/**
 * System One HTTP 响应体。
 *
 * @param model 实际执行判断的 Jev 模型版本
 * @param answers 以请求 question id 为键的 Noul 答案
 * @param usage 本次 Jev 请求的 Token 用量
 */
public record JevSystemOneResponse(
        String model,
        Map<String, JevNoulAnswer> answers,
        JevUsage usage
) {
}
