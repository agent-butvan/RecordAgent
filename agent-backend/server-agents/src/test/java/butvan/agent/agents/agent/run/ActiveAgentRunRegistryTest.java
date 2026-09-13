package butvan.agent.agents.agent.run;

import butvan.agent.agents.session.AgentStreamSession;
import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ActiveAgentRunRegistryTest {

    @Test
    void cancelsOnlyExactUserSessionAndRun() {
        ActiveAgentRunRegistry registry = new ActiveAgentRunRegistry();
        AgentStreamSession session = new AgentStreamSession("run-1");
        AtomicInteger interrupts = new AtomicInteger();
        session.bindCancellationAction(interrupts::incrementAndGet);
        registry.register("user-1", "session-1", session);

        assertFalse(registry.cancel("user-1", "stale-session", "run-1").accepted());
        assertFalse(registry.cancel("other-user", "session-1", "run-1").accepted());
        assertTrue(registry.cancel("user-1", "session-1", "run-1").accepted());
        assertFalse(registry.cancel("user-1", "session-1", "run-1").accepted());
        assertEquals(1, interrupts.get());
    }

    @Test
    void preventsConcurrentRunsWithinOneSessionAndReleasesExactHandle() {
        ActiveAgentRunRegistry registry = new ActiveAgentRunRegistry();
        AgentStreamSession first = new AgentStreamSession("run-1");
        AgentStreamSession second = new AgentStreamSession("run-2");
        registry.register("user-1", "session-1", first);

        assertThrows(IllegalArgumentException.class,
                () -> registry.register("user-1", "session-1", second));

        registry.unregister("user-1", "session-1", first);
        registry.register("user-1", "session-1", second);
        assertTrue(registry.cancel("user-1", "session-1", "run-2").accepted());
    }
}
