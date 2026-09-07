package butvan.agent.agents.agent.run;

import butvan.agent.agents.usage.TokenUsageRoundContext;
import butvan.agent.agents.usage.TurnUsageAccumulator;
import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.message.Msg;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class AgentRunTokenUsageContextTest {

    @Test
    void bindsRoundCollectorAndMarksTheCurrentUserMessage() {
        RuntimeContext context = RuntimeContext.builder()
                .userId("user-1").sessionId("session-1").build();
        AgentRun run = new AgentRun("session-1", "user-1", "turn-1", context);

        Msg message = run.currentUserMessage("hello");

        assertNotNull(context.get(TurnUsageAccumulator.class));
        assertEquals("turn-1", context.get(TokenUsageRoundContext.class).turnId());
        assertEquals("turn-1", message.getMetadata().get(TokenUsageRoundContext.TURN_METADATA_KEY));
    }
}
