package butvan.agent.agents.usage;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;

class ApproximateTokenCounterTest {

    private final TokenCounter counter = new ApproximateTokenCounter();

    @Test
    void estimatesAsciiAndCjkWithoutNetworkCalls() {
        assertAll(
                () -> assertEquals(0, counter.count("")),
                () -> assertEquals(1, counter.count("test")),
                () -> assertEquals(4, counter.count("你好世界")),
                () -> assertEquals("approximate-v1", counter.id())
        );
    }
}
