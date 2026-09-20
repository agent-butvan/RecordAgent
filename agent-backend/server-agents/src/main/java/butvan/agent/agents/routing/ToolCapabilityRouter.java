package butvan.agent.agents.routing;

/**
 * 主流程依赖的 Tool 能力路由抽象。
 */
public interface ToolCapabilityRouter {

    /**
     * 根据当前用户请求选择可能需要的能力组。
     *
     * @param request 当前用户输入与可选能力组
     * @return 当前轮次的路由决策
     */
    ToolRoutingDecision route(ToolRoutingRequest request);
}
