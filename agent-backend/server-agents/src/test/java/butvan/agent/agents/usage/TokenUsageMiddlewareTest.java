package butvan.agent.agents.usage;

import butvan.agent.agents.context.ContextInjectionMiddleware;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.event.AgentEvent;
import io.agentscope.core.event.ModelCallEndEvent;
import io.agentscope.core.event.ModelCallStartEvent;
import io.agentscope.core.message.AssistantMessage;
import io.agentscope.core.message.SystemMessage;
import io.agentscope.core.message.ToolResultMessage;
import io.agentscope.core.message.UserMessage;
import io.agentscope.core.middleware.ModelCallInput;
import io.agentscope.core.model.ChatUsage;
import io.agentscope.core.model.ToolSchema;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TokenUsageMiddlewareTest {

    @Test
    void recordsTheFinalLogicalInputAndProviderUsageForOneModelCall() {
        TokenCounter counter = new FixtureTokenCounter();
        TokenUsageMiddleware middleware = new TokenUsageMiddleware(counter, new ObjectMapper());
        TurnUsageAccumulator accumulator = new TurnUsageAccumulator();
        RuntimeContext context = RuntimeContext.builder()
                .sessionId("conversation-1")
                .put(TurnUsageAccumulator.class, accumulator)
                .put(TokenUsageRoundContext.class, new TokenUsageRoundContext("turn-current"))
                .build();
        ModelCallInput input = new ModelCallInput(
                List.of(
                        new SystemMessage("system prompt"),
                        new UserMessage("old user"),
                        new AssistantMessage("old assistant"),
                        UserMessage.builder().textContent("current user")
                                .metadata(Map.of(TokenUsageRoundContext.TURN_METADATA_KEY, "turn-current"))
                                .build(),
                        new AssistantMessage("current protocol"),
                        new ToolResultMessage("tool-call-1", "search_web", "tool output")
                ),
                List.of(ToolSchema.builder()
                        .name("search_web")
                        .description("schema description")
                        .parameters(Map.of("type", "object"))
                        .build()),
                null,
                null
        );

        List<AgentEvent> events = middleware.onModelCall(null, context, input, ignored -> Flux.just(
                new ModelCallStartEvent("call-1"),
                new ModelCallEndEvent("call-1", ChatUsage.builder()
                        .inputTokens(200).outputTokens(7).cachedTokens(4).time(0.25).build())
        )).collectList().block();

        TurnTokenUsage usage = accumulator.snapshot();
        InputTokenBreakdown breakdown = usage.breakdown();
        assertAll(
                () -> assertEquals(2, events.size()),
                () -> assertEquals(10, breakdown.systemPromptTokens()),
                () -> assertEquals(50, breakdown.historyTokens()),
                () -> assertEquals(5, breakdown.currentUserTokens()),
                () -> assertEquals(40, breakdown.toolSchemaTokens()),
                () -> assertEquals(60, breakdown.toolResultTokens()),
                () -> assertEquals(0, breakdown.ragContextTokens()),
                () -> assertEquals(35, breakdown.otherTokens()),
                () -> assertEquals(165, usage.estimatedInputTokens()),
                () -> assertEquals(200, usage.inputTokens()),
                () -> assertEquals(7, usage.outputTokens()),
                () -> assertEquals(250, usage.durationMillis()),
                () -> assertEquals(1, usage.modelCallCount()),
                () -> assertEquals("search_web", usage.toolUsages().getFirst().toolName()),
                () -> assertEquals(40, usage.toolUsages().getFirst().schemaTokens()),
                () -> assertEquals(60, usage.toolUsages().getFirst().resultTokens())
        );
    }

    @Test
    void accumulatesRepeatedContextAndToolSchemaAcrossToolLoopCalls() {
        TokenUsageMiddleware middleware = new TokenUsageMiddleware(
                new FixtureTokenCounter(), new ObjectMapper());
        TurnUsageAccumulator accumulator = new TurnUsageAccumulator();
        RuntimeContext context = RuntimeContext.builder()
                .sessionId("conversation-1")
                .put(TurnUsageAccumulator.class, accumulator)
                .put(TokenUsageRoundContext.class, new TokenUsageRoundContext("turn-current"))
                .build();
        UserMessage currentUser = UserMessage.builder().textContent("current user")
                .metadata(Map.of(TokenUsageRoundContext.TURN_METADATA_KEY, "turn-current"))
                .build();
        ToolSchema searchTool = ToolSchema.builder()
                .name("search_web")
                .description("schema description")
                .parameters(Map.of("type", "object"))
                .build();

        middleware.onModelCall(null, context,
                new ModelCallInput(
                        List.of(new SystemMessage("system prompt"), currentUser),
                        List.of(searchTool), null, null),
                ignored -> Flux.just(
                        new ModelCallStartEvent("call-1"),
                        new ModelCallEndEvent("call-1", ChatUsage.builder()
                                .inputTokens(70).outputTokens(3).time(0.1).build())))
                .collectList().block();
        middleware.onModelCall(null, context,
                new ModelCallInput(
                        List.of(
                                new SystemMessage("system prompt"),
                                new UserMessage("old user"),
                                new AssistantMessage("old assistant"),
                                currentUser,
                                new ToolResultMessage("tool-call-1", "search_web", "tool output")
                        ),
                        List.of(searchTool), null, null),
                ignored -> Flux.just(
                        new ModelCallStartEvent("call-2"),
                        new ModelCallEndEvent("call-2", ChatUsage.builder()
                                .inputTokens(190).outputTokens(7).time(0.2).build())))
                .collectList().block();

        TurnTokenUsage usage = accumulator.snapshot();
        assertAll(
                () -> assertEquals(2, usage.modelCallCount()),
                () -> assertEquals(260, usage.inputTokens()),
                () -> assertEquals(10, usage.outputTokens()),
                () -> assertEquals(20, usage.breakdown().systemPromptTokens()),
                () -> assertEquals(50, usage.breakdown().historyTokens()),
                () -> assertEquals(10, usage.breakdown().currentUserTokens()),
                () -> assertEquals(80, usage.breakdown().toolSchemaTokens()),
                () -> assertEquals(60, usage.breakdown().toolResultTokens()),
                () -> assertEquals(40, usage.breakdown().otherTokens()),
                () -> assertEquals(220, usage.estimatedInputTokens()),
                () -> assertEquals(80, usage.toolUsages().getFirst().schemaTokens()),
                () -> assertEquals(60, usage.toolUsages().getFirst().resultTokens()),
                () -> assertEquals(1, usage.calls().getFirst().modelCallIndex()),
                () -> assertEquals(2, usage.calls().getLast().modelCallIndex())
        );
    }

    @Test
    void separatesTenHistoricalMessagesAndMultipleExposedTools() {
        TokenUsageMiddleware middleware = new TokenUsageMiddleware(
                new LengthTokenCounter(), new ObjectMapper());
        TurnUsageAccumulator accumulator = new TurnUsageAccumulator();
        RuntimeContext context = RuntimeContext.builder()
                .put(TurnUsageAccumulator.class, accumulator)
                .put(TokenUsageRoundContext.class, new TokenUsageRoundContext("turn-current"))
                .build();
        List<io.agentscope.core.message.Msg> messages = new ArrayList<>();
        messages.add(new SystemMessage("s"));
        for (int index = 0; index < 5; index++) {
            messages.add(new UserMessage("1234"));
            messages.add(new AssistantMessage("12"));
        }
        messages.add(UserMessage.builder().textContent("now")
                .metadata(Map.of(TokenUsageRoundContext.TURN_METADATA_KEY, "turn-current"))
                .build());

        middleware.onModelCall(null, context,
                new ModelCallInput(messages, List.of(
                        ToolSchema.builder().name("search_web").description("search").build(),
                        ToolSchema.builder().name("read_file").description("read").build()
                ), null, null),
                ignored -> Flux.just(
                        new ModelCallStartEvent("call-history"),
                        new ModelCallEndEvent("call-history", ChatUsage.builder()
                                .inputTokens(500).outputTokens(1).build())))
                .collectList().block();

        TurnTokenUsage usage = accumulator.snapshot();
        assertAll(
                () -> assertEquals(1, usage.breakdown().systemPromptTokens()),
                () -> assertEquals(30, usage.breakdown().historyTokens()),
                () -> assertEquals(3, usage.breakdown().currentUserTokens()),
                () -> assertEquals(2, usage.toolUsages().size()),
                () -> assertEquals("search_web", usage.toolUsages().getFirst().toolName()),
                () -> assertEquals("read_file", usage.toolUsages().getLast().toolName()),
                () -> assertTrue(usage.toolUsages().stream().allMatch(tool -> tool.schemaTokens() > 0))
        );
    }

    @Test
    void attributesReferencedRecordTextToRagContext() {
        TokenUsageMiddleware middleware = new TokenUsageMiddleware(
                new LengthTokenCounter(), new ObjectMapper());
        TurnUsageAccumulator accumulator = new TurnUsageAccumulator();
        RuntimeContext context = RuntimeContext.builder()
                .put(TurnUsageAccumulator.class, accumulator)
                .put(TokenUsageRoundContext.class,
                        new TokenUsageRoundContext("turn-current", List.of("record text")))
                .build();
        var currentUser = UserMessage.builder().textContent("question + record text")
                .metadata(Map.of(TokenUsageRoundContext.TURN_METADATA_KEY, "turn-current"))
                .build();

        middleware.onModelCall(null, context,
                new ModelCallInput(List.of(currentUser), List.of(), null, null),
                ignored -> Flux.just(
                        new ModelCallStartEvent("call-rag"),
                        new ModelCallEndEvent("call-rag", ChatUsage.builder()
                                .inputTokens(22).outputTokens(1).build())))
                .collectList().block();

        assertAll(
                () -> assertEquals(11, accumulator.snapshot().breakdown().ragContextTokens()),
                () -> assertEquals(11, accumulator.snapshot().breakdown().currentUserTokens())
        );
    }

    @Test
    void attributesSyntheticManagedContextWithoutTreatingItAsHistory() {
        TokenUsageMiddleware middleware = new TokenUsageMiddleware(
                new LengthTokenCounter(), new ObjectMapper());
        TurnUsageAccumulator accumulator = new TurnUsageAccumulator();
        RuntimeContext context = RuntimeContext.builder()
                .put(TurnUsageAccumulator.class, accumulator)
                .put(TokenUsageRoundContext.class, new TokenUsageRoundContext("turn-current"))
                .build();
        var managedContext = UserMessage.builder().textContent("profile-memory")
                .metadata(Map.of(ContextInjectionMiddleware.CONTEXT_METADATA_KEY, true))
                .build();
        var currentUser = UserMessage.builder().textContent("question")
                .metadata(Map.of(TokenUsageRoundContext.TURN_METADATA_KEY, "turn-current"))
                .build();

        middleware.onModelCall(null, context,
                new ModelCallInput(List.of(managedContext, currentUser), List.of(), null, null),
                ignored -> Flux.just(
                        new ModelCallStartEvent("call-context"),
                        new ModelCallEndEvent("call-context", ChatUsage.builder()
                                .inputTokens(22).outputTokens(1).build())))
                .collectList().block();

        assertAll(
                () -> assertEquals(14, accumulator.snapshot().breakdown().ragContextTokens()),
                () -> assertEquals(8, accumulator.snapshot().breakdown().currentUserTokens()),
                () -> assertEquals(0, accumulator.snapshot().breakdown().historyTokens())
        );
    }

    private static final class FixtureTokenCounter implements TokenCounter {
        @Override
        public int count(String text) {
            if (text.contains("system prompt")) return 10;
            if (text.contains("old user")) return 20;
            if (text.contains("old assistant")) return 30;
            if (text.contains("current user")) return 5;
            if (text.contains("tool output")) return 60;
            if (text.contains("schema description")) return 40;
            return 0;
        }

        @Override
        public String id() {
            return "fixture";
        }
    }

    private static final class LengthTokenCounter implements TokenCounter {
        @Override
        public int count(String text) {
            return text == null ? 0 : text.length();
        }

        @Override
        public String id() {
            return "length-fixture";
        }
    }
}
