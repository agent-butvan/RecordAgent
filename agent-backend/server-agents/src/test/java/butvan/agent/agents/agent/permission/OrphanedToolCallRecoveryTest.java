package butvan.agent.agents.agent.permission;

import io.agentscope.core.message.Msg;
import io.agentscope.core.message.MsgRole;
import io.agentscope.core.message.ToolCallState;
import io.agentscope.core.message.ToolResultBlock;
import io.agentscope.core.message.ToolUseBlock;
import io.agentscope.core.state.AgentState;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class OrphanedToolCallRecoveryTest {

    @Test
    void addsErrorResultsOnlyForUnresolvedCallsFromInterruptedRun() {
        ToolUseBlock completed = new ToolUseBlock("call-1", "execute", Map.of("command", "ls"));
        ToolUseBlock orphaned = new ToolUseBlock("call-2", "execute", Map.of("command", "pwd"))
                .withState(ToolCallState.ASKING);
        Msg assistant = Msg.builder().name("butvan_agent").role(MsgRole.ASSISTANT)
                .content(completed, orphaned).build();
        Msg existingResult = Msg.builder().name("butvan_agent").role(MsgRole.TOOL)
                .content(ToolResultBlock.text("ok").withIdAndName("call-1", "execute")).build();
        AgentState state = AgentState.builder().userId("local-default").sessionId("session-1")
                .context(List.of(assistant, existingResult)).build();

        int recovered = new OrphanedToolCallRecovery().recover(state, "butvan_agent");

        assertEquals(1, recovered);
        List<ToolResultBlock> results = state.getContext().stream()
                .flatMap(message -> message.getContentBlocks(ToolResultBlock.class).stream())
                .toList();
        assertEquals(List.of("call-1", "call-2"), results.stream().map(ToolResultBlock::getId).toList());
    }
}
