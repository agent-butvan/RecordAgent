package butvan.agent.agents.agent.event;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class AgentStreamEventTest {

    @Test
    void routingNoticeIsNonTerminalAndUsesStablePayload() {
        AgentStreamEvent.RoutingNotice notice = new AgentStreamEvent.RoutingNotice(
                "rate_limit",
                "Jev 请求受限，已使用本地工具路由。",
                "req_123",
                true,
                750L
        );

        assertEquals("routing_notice", notice.eventName());
        assertFalse(notice.isTerminal());
        assertEquals(Map.of(
                "code", "rate_limit",
                "message", "Jev 请求受限，已使用本地工具路由。",
                "requestId", "req_123",
                "retryable", true,
                "retryAfterMillis", 750L
        ), notice.payload());
    }
}
