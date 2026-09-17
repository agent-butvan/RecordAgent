package butvan.agent.agents.agent.permission;

import io.agentscope.core.message.Msg;
import io.agentscope.core.message.MsgRole;
import io.agentscope.core.message.ToolResultBlock;
import io.agentscope.core.message.ToolResultState;
import io.agentscope.core.message.ToolUseBlock;
import io.agentscope.core.state.AgentState;
import io.agentscope.core.tool.ToolResultMessageBuilder;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** 在新用户轮次开始前，为上次进程遗留的未完成工具调用补齐安全失败结果。 */
@Component
public class OrphanedToolCallRecovery {

    /**
     * 只处理最后一条 assistant 消息中缺少结果的工具；正常 HITL 恢复不得调用此方法。
     *
     * @return 新增的失败结果数量
     */
    public int recover(AgentState state, String agentName) {
        List<Msg> context = state.contextMutable();
        int lastAssistantIndex = -1;
        Msg lastAssistant = null;
        for (int index = context.size() - 1; index >= 0; index--) {
            if (context.get(index).getRole() == MsgRole.ASSISTANT) {
                lastAssistantIndex = index;
                lastAssistant = context.get(index);
                break;
            }
        }
        if (lastAssistant == null) return 0;

        Set<String> completedIds = new HashSet<>();
        for (int i = lastAssistantIndex + 1; i < context.size(); i++) {
            context.get(i).getContentBlocks(ToolResultBlock.class).stream()
                    .map(ToolResultBlock::getId)
                    .forEach(completedIds::add);
        }
        List<ToolUseBlock> orphaned = lastAssistant.getContentBlocks(ToolUseBlock.class).stream()
                .filter(tool -> !completedIds.contains(tool.getId()))
                .toList();

        for (ToolUseBlock tool : orphaned) {
            ToolResultBlock result = ToolResultBlock
                    .text("[ERROR] Previous tool execution failed or was interrupted. Tool: " + tool.getName())
                    .withState(ToolResultState.ERROR);
            context.add(ToolResultMessageBuilder.buildToolResultMsg(result, tool, agentName));
        }
        return orphaned.size();
    }
}
