package butvan.agent.agents.agent;

import butvan.agent.agents.agent.event.AgentStreamEvent;
import io.agentscope.core.event.ToolResultEndEvent;
import io.agentscope.core.event.ToolResultTextDeltaEvent;
import io.agentscope.core.message.ToolResultState;
import org.junit.jupiter.api.Test;

import java.util.HashMap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

class AgentEventManagerTest {

    private final AgentEventManager manager = new AgentEventManager();

    @Test
    void resultDeltaKeepsToolRunningUntilEndEvent() {
        AgentStreamEvent.ToolResult mapped = assertInstanceOf(
                AgentStreamEvent.ToolResult.class,
                manager.map(new ToolResultTextDeltaEvent(
                        "reply-1", "call-1", "web_search", "partial"), new HashMap<>())
        );

        assertEquals(AgentStreamEvent.ToolStatus.RUNNING, mapped.status());
        assertEquals("partial", mapped.result());
    }

    @Test
    void errorEndEventMarksToolFailed() {
        AgentStreamEvent.ToolResult mapped = assertInstanceOf(
                AgentStreamEvent.ToolResult.class,
                manager.map(new ToolResultEndEvent(
                        "reply-1", "call-1", "web_search", ToolResultState.ERROR), new HashMap<>())
        );

        assertEquals(AgentStreamEvent.ToolStatus.FAILED, mapped.status());
        assertEquals("", mapped.result());
    }
}
