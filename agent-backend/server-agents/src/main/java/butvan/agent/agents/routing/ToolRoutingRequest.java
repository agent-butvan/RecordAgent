package butvan.agent.agents.routing;

import java.util.Set;

/**
 *  一次用户轮次提交给 Tool 路由器的最小输入
 *
 * @param userInput 用户当前可见的请求文本
 * @param availableGroups 本次允许 Jev 判断的能力组名称集合
 */
public record ToolRoutingRequest(
        String userInput,
        Set<String> availableGroups
) {
}
