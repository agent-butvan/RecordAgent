package butvan.agent.agents.routing;

import io.agentscope.core.state.AgentState;
import org.springframework.stereotype.Component;

import java.util.List;

/** 将 ACTIVE 路由决策同步到 AgentScope 的会话级工具状态。 */
@Component
public class ToolRoutingStateSynchronizer {

    /**
     * 使用 Jev 选中的能力组替换当前会话的已激活工具组。
     *
     * <p>模型可见 Schema 与 ToolExecutor 都依赖这份会话状态。这里只修改当前
     * {@link AgentState}，不修改跨会话共享的 Toolkit。</p>
     *
     * @param state 当前用户、当前会话的 AgentScope 状态
     * @param decision 当前用户轮次的路由决策
     * @return 会话状态发生变化时返回 true
     */
    public boolean apply(AgentState state, ToolRoutingDecision decision) {
        if (state == null || decision == null || !decision.appliesToModelCall()) {
            return false;
        }

        // selectedGroups：排序后的能力组快照，保证状态文件内容稳定。
        List<String> selectedGroups = decision.selectedGroups().stream().sorted().toList();
        if (selectedGroups.equals(state.getToolContext().getActivatedGroups())) {
            return false;
        }

        state.getToolContext().setActivatedGroups(selectedGroups);
        return true;
    }
}
