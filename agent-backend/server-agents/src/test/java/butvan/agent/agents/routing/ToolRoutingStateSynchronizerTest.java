package butvan.agent.agents.routing;

import io.agentscope.core.state.AgentState;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ToolRoutingStateSynchronizerTest {

    private final ToolRoutingStateSynchronizer synchronizer =
            new ToolRoutingStateSynchronizer();

    @Test
    void activeDecisionReplacesSessionActivatedGroupsBeforeExecution() {
        AgentState state = AgentState.builder().build();
        state.getToolContext().setActivatedGroups(List.of("calendar"));
        ToolRoutingDecision decision = new ToolRoutingDecision(
                ToolRoutingDecision.Status.ACTIVE,
                Set.of("web"),
                Map.of("web", 0.96),
                "jev-test",
                20
        );

        boolean changed = synchronizer.apply(state, decision);

        assertTrue(changed);
        assertEquals(List.of("web"), state.getToolContext().getActivatedGroups());
    }

    @Test
    void shadowDecisionDoesNotChangeSessionActivatedGroups() {
        AgentState state = AgentState.builder().build();
        state.getToolContext().setActivatedGroups(List.of("calendar"));
        ToolRoutingDecision decision = new ToolRoutingDecision(
                ToolRoutingDecision.Status.SHADOW,
                Set.of("web"),
                Map.of("web", 0.96),
                "jev-test",
                20
        );

        boolean changed = synchronizer.apply(state, decision);

        assertFalse(changed);
        assertEquals(List.of("calendar"), state.getToolContext().getActivatedGroups());
    }
}
