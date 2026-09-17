package butvan.agent.agents.usage;

import io.agentscope.core.event.ModelCallEndEvent;
import io.agentscope.core.event.ModelCallStartEvent;
import io.agentscope.core.model.ChatUsage;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;

class TurnUsageAccumulatorTest {

    private static final ModelIdentity MODEL = new ModelIdentity("openai", "gpt-test");

    @Test
    void aggregatesMainToolLoopAndSubagentCalls() {
        TurnUsageAccumulator accumulator = new TurnUsageAccumulator();
        accumulator.record(new ModelCallStartEvent("main-call"), MODEL, UsagePurpose.CHAT);
        accumulator.record(new ModelCallEndEvent("main-call", usage(100, 20, 30, 1.25)),
                MODEL, UsagePurpose.CHAT);
        accumulator.record(new ModelCallStartEvent("tool-follow-up"), MODEL, UsagePurpose.CHAT);
        accumulator.record(new ModelCallEndEvent("tool-follow-up", usage(80, 10, 0, 0.5)),
                MODEL, UsagePurpose.CHAT);
        accumulator.record(new ModelCallStartEvent("child-call").withSource("main/explore"),
                MODEL, UsagePurpose.CHAT);
        accumulator.record(new ModelCallEndEvent("child-call", usage(60, 15, 5, 0.75))
                        .withSource("main/explore"),
                MODEL, UsagePurpose.CHAT);

        TurnTokenUsage result = accumulator.snapshot();

        assertAll(
                () -> assertEquals(240, result.inputTokens()),
                () -> assertEquals(45, result.outputTokens()),
                () -> assertEquals(35, result.cachedInputTokens()),
                () -> assertEquals(285, result.totalTokens()),
                () -> assertEquals(3, result.modelCallCount()),
                () -> assertEquals(3, result.reportedCallCount()),
                () -> assertEquals(UsageStatus.COMPLETE, result.status()),
                () -> assertEquals("main", result.calls().getFirst().source()),
                () -> assertEquals("main/explore", result.calls().getLast().source())
        );
    }

    @Test
    void marksMissingEndUsageAsPartialAndDoesNotDoubleCountDuplicates() {
        TurnUsageAccumulator accumulator = new TurnUsageAccumulator();
        accumulator.record(new ModelCallStartEvent("reported"), MODEL, UsagePurpose.CHAT);
        ModelCallEndEvent end = new ModelCallEndEvent("reported", usage(12, 8, 3, 0.2));
        accumulator.record(end, MODEL, UsagePurpose.CHAT);
        accumulator.record(end, MODEL, UsagePurpose.CHAT);
        accumulator.record(new ModelCallStartEvent("cancelled"), MODEL, UsagePurpose.CHAT);

        TurnTokenUsage result = accumulator.snapshot();

        assertAll(
                () -> assertEquals(2, result.modelCallCount()),
                () -> assertEquals(1, result.reportedCallCount()),
                () -> assertEquals(20, result.totalTokens()),
                () -> assertEquals(UsageStatus.PARTIAL, result.status()),
                () -> assertEquals(UsageStatus.UNAVAILABLE, result.calls().getLast().status())
        );
    }

    @Test
    void treatsProviderUsageAsReportedEvenWhenAllCountsAreZero() {
        TurnUsageAccumulator accumulator = new TurnUsageAccumulator();
        accumulator.record(new ModelCallEndEvent("zero", usage(0, 0, 0, 0)),
                MODEL, UsagePurpose.CHAT);

        TurnTokenUsage result = accumulator.snapshot();

        assertAll(
                () -> assertEquals(1, result.modelCallCount()),
                () -> assertEquals(1, result.reportedCallCount()),
                () -> assertEquals(UsageStatus.COMPLETE, result.status())
        );
    }

    private ChatUsage usage(int input, int output, int cached, double seconds) {
        return ChatUsage.builder()
                .inputTokens(input)
                .outputTokens(output)
                .cachedTokens(cached)
                .time(seconds)
                .build();
    }
}
