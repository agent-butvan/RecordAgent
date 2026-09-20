package butvan.agent.agents.agent.run;

import butvan.agent.agents.agent.event.AgentStreamEvent;
import butvan.agent.agents.session.dto.TranscriptMessageDto;
import io.agentscope.core.agent.RuntimeContext;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AgentRunToolStatusTest {

    @Test
    void terminalToolErrorOverridesRunningDeltaStatus() {
        AgentRun run = new AgentRun(
                "session-1",
                "user-1",
                "turn-1",
                RuntimeContext.builder().userId("user-1").sessionId("session-1").build()
        );

        run.record(new AgentStreamEvent.ToolCall("call-1", "web_search", "{}"));
        run.record(new AgentStreamEvent.ToolResult(
                "call-1", "web_search", "Unauthorized", AgentStreamEvent.ToolStatus.RUNNING));
        run.record(new AgentStreamEvent.ToolResult(
                "call-1", "web_search", "", AgentStreamEvent.ToolStatus.FAILED));

        TranscriptMessageDto.ToolExecutionDto tool = run.finalizeTools(
                TranscriptMessageDto.MessageStatus.COMPLETED).getFirst();

        assertEquals(TranscriptMessageDto.ToolStatus.FAILED, tool.status());
        assertEquals("Unauthorized", tool.output());
    }
}
