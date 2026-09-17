package butvan.agent.agents.usage;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;

class TokenUsageAggregatorTest {

    @Test
    void summarizesCompleteTrackedTurns() {
        TokenUsageSummary result = TokenUsageAggregator.summarize(2, List.of(
                usage(100, 20, 10, 2, 2, UsageStatus.COMPLETE),
                usage(50, 15, 5, 1, 1, UsageStatus.COMPLETE)
        ));

        assertAll(
                () -> assertEquals(150, result.inputTokens()),
                () -> assertEquals(35, result.outputTokens()),
                () -> assertEquals(15, result.cachedInputTokens()),
                () -> assertEquals(185, result.totalTokens()),
                () -> assertEquals(2, result.turnCount()),
                () -> assertEquals(2, result.trackedTurnCount()),
                () -> assertEquals(3, result.modelCallCount()),
                () -> assertEquals(UsageStatus.COMPLETE, result.status())
        );
    }

    @Test
    void marksSummaryPartialWhenLegacyOrIncompleteTurnsExist() {
        TokenUsageSummary legacyResult = TokenUsageAggregator.summarize(2, List.of(
                usage(10, 5, 0, 1, 1, UsageStatus.COMPLETE)
        ));
        TokenUsageSummary incompleteResult = TokenUsageAggregator.summarize(1, List.of(
                usage(10, 5, 0, 2, 1, UsageStatus.PARTIAL)
        ));

        assertAll(
                () -> assertEquals(UsageStatus.PARTIAL, legacyResult.status()),
                () -> assertEquals(1, legacyResult.trackedTurnCount()),
                () -> assertEquals(UsageStatus.PARTIAL, incompleteResult.status())
        );
    }

    @Test
    void returnsUnavailableWhenNoProviderUsageWasReported() {
        TokenUsageSummary result = TokenUsageAggregator.summarize(1, List.of(
                usage(0, 0, 0, 1, 0, UsageStatus.UNAVAILABLE)
        ));

        assertEquals(UsageStatus.UNAVAILABLE, result.status());
    }

    private TurnTokenUsage usage(
            long input,
            long output,
            long cached,
            int callCount,
            int reportedCount,
            UsageStatus status
    ) {
        return new TurnTokenUsage(
                input,
                output,
                cached,
                input + output,
                callCount,
                reportedCount,
                status,
                List.of()
        );
    }
}
