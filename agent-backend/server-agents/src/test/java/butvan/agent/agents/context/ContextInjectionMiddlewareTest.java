package butvan.agent.agents.context;

import butvan.agent.agents.usage.TokenUsageRoundContext;
import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.SystemMessage;
import io.agentscope.core.message.UserMessage;
import io.agentscope.core.middleware.ModelCallInput;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ContextInjectionMiddlewareTest {

    @Test
    void injectsSyntheticContextOnlyIntoTheForwardedModelInput() {
        ContextEnvelope envelope = new ContextEnvelope(
                "<context-envelope>profile</context-envelope>", List.of(), 10);
        RuntimeContext context = RuntimeContext.builder()
                .put(ContextEnvelope.class, envelope)
                .put(TokenUsageRoundContext.class, new TokenUsageRoundContext("turn-1"))
                .build();
        Msg currentUser = UserMessage.builder().textContent("真实问题")
                .metadata(Map.of(TokenUsageRoundContext.TURN_METADATA_KEY, "turn-1"))
                .build();
        ModelCallInput original = new ModelCallInput(
                List.of(new SystemMessage("system"), currentUser), List.of(), null, null);
        AtomicReference<ModelCallInput> forwarded = new AtomicReference<>();

        new ContextInjectionMiddleware().onModelCall(null, context, original, input -> {
            forwarded.set(input);
            return Flux.empty();
        }).blockLast();

        assertEquals(2, original.messages().size());
        assertEquals(3, forwarded.get().messages().size());
        assertNotSame(original.messages(), forwarded.get().messages());
        Msg injected = forwarded.get().messages().get(1);
        assertEquals("managed_context", injected.getName());
        assertTrue(Boolean.TRUE.equals(injected.getMetadata().get(Msg.METADATA_SYNTHETIC)));
        assertEquals(currentUser, forwarded.get().messages().get(2));
    }
}
