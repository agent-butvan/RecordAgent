package butvan.agent.agents.routing;

/**
 * 单个 Noul 问题的响应。
 *
 * @param type 响应类型，预期为 noul
 * @param noul 答案为 yes 的概率，范围为 0..1
 */
public record JevNoulAnswer(
        String type,
        Double noul
) {
}
