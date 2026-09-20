package butvan.agent.agents.routing;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * TypeSafe 返回的本次请求 Token 用量。
 *
 * @param inputTokens TypeSafe 统计的输入 Token 数
 * @param outputTokens TypeSafe 统计的输出 Token 数
 */
public record JevUsage(
        @JsonProperty("input_tokens") long inputTokens,
        @JsonProperty("output_tokens") long outputTokens
) {
}
