package butvan.agent.agents.routing;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 发送给 System One 的一个 Noul 二分类问题。
 *
 * @param type 固定为 noul
 * @param instructions Jev 需要判断的问题文本
 * @param criteria yes/no 两种结果的业务含义
 */
public record JevNoulQuestion(
        String type,
        String instructions,
        Criteria criteria
) {

    /**
     * 使用项目统一的判定语义创建 Noul 问题。
     *
     * @param instructions Jev 需要判断的问题文本
     * @return 可直接加入 System One 请求的问题
     */
    public static JevNoulQuestion of(String instructions) {
        return new JevNoulQuestion(
                "noul",
                instructions,
                new Criteria("需要该能力组", "不需要该能力组")
        );
    }

    /**
     * Noul 两端概率的语义说明。
     *
     * @param yes 概率接近 1 时代表的含义，序列化字段名为 true
     * @param no 概率接近 0 时代表的含义，序列化字段名为 false
     */
    public record Criteria(
            @JsonProperty("true") String yes,
            @JsonProperty("false") String no
    ) {
    }
}
