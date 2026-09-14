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
    void cancellationWaitsForRuntimeBindingBeforeInterruptingProducer() {
        AgentStreamSession session = new AgentStreamSession("run-safe-point");
        AtomicInteger producerInterrupts = new AtomicInteger();
        Thread producer = new Thread() {
            @Override
            public void interrupt() {
                producerInterrupts.incrementAndGet();
            }
        };
        session.bindProducer(producer);

        assertTrue(session.requestCancellation());
        assertEquals(0, producerInterrupts.get());

        session.bindCancellationAction(() -> { });
        assertEquals(1, producerInterrupts.get());
        assertFalse(session.requestCancellation());
        assertEquals(1, producerInterrupts.get());
    }

    @Test
    void failedRuntimeCancellationStillInterruptsProducer() {
        AgentStreamSession session = new AgentStreamSession("run-action-failure");
        AtomicInteger producerInterrupts = new AtomicInteger();
        Thread producer = new Thread() {
            @Override
            public void interrupt() {
                producerInterrupts.incrementAndGet();
            }
        };
        session.bindProducer(producer);
        session.bindCancellationAction(() -> {
            throw new IllegalStateException("模拟 AgentScope 中断失败");
        });

        assertTrue(session.requestCancellation());
        assertEquals(1, producerInterrupts.get());
    }

    @Test
    void cancellationTerminalIsQueuedOnlyOnce() {
        AgentStreamSession session = new AgentStreamSession("run-2");

        assertTrue(session.offerTerminal(new AgentStreamEvent.Cancelled("run-2")));
        assertFalse(session.offerTerminal(new AgentStreamEvent.Completed()));
        assertInstanceOf(AgentStreamEvent.Cancelled.class, session.queue().poll());
    }

    @Test
    void terminalReplacesBacklogWhenQueueIsFull() {
        AgentStreamSession session = new AgentStreamSession("run-full-queue");
        for (int index = 0; index < 64; index++) {
            assertTrue(session.queue().offer(new AgentStreamEvent.TextDelta("chunk-" + index)));
        }

        assertTrue(session.offerTerminal(new AgentStreamEvent.Cancelled("run-full-queue")));
        assertEquals(1, session.queue().size());
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
