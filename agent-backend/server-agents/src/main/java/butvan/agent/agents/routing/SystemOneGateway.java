package butvan.agent.agents.routing;

import java.util.Map;

/**
 * 对 TypeSafe System One HTTP API 的项目内抽象。
 */
public interface SystemOneGateway {

    /**
     * 调用 System One，批量判断多个 Noul 问题。
     *
     * @param apiKey 当前用户的 TypeSafe API Key
     * @param model Jev 模型名称或别名
     * @param state 当前用户可见的请求文本
     * @param questions 以能力组名为键的 Noul 问题
     * @return TypeSafe 返回的结构化判断结果
     */
    JevSystemOneResponse evaluate(
            String apiKey,
            String model,
            String state,
            Map<String, JevNoulQuestion> questions
    );
}
