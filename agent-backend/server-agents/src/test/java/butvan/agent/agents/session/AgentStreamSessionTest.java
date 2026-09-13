package butvan.agent.agents.session;

import butvan.agent.agents.agent.event.AgentStreamEvent;
import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AgentStreamSessionTest {

    @Test
    void cancellationIsIdempotentAndReachesLateBoundRuntimeAction() {
        AgentStreamSession session = new AgentStreamSession("run-1");
        AtomicInteger interrupts = new AtomicInteger();

        assertTrue(session.requestCancellation());
        session.bindCancellationAction(interrupts::incrementAndGet);

        assertFalse(session.requestCancellation());
        assertTrue(session.isCancelled());
        assertEquals(1, interrupts.get());
    }

    @Test
    void cancellationTerminalIsQueuedOnlyOnce() {
        AgentStreamSession session = new AgentStreamSession("run-2");

        assertTrue(session.offerTerminal(new AgentStreamEvent.Cancelled("run-2")));
        assertFalse(session.offerTerminal(new AgentStreamEvent.Completed()));
        assertInstanceOf(AgentStreamEvent.Cancelled.class, session.queue().poll());
    }

    @Test
    void closedTransportDoesNotQueueTerminal() {
        AgentStreamSession session = new AgentStreamSession("run-3");

        session.closeTransport();

        assertFalse(session.offerTerminal(new AgentStreamEvent.Cancelled("run-3")));
        assertTrue(session.queue().isEmpty());
    }
}
