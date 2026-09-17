package butvan.agent.network.service.task;

import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** 验证应用关闭时常驻任务 SSE 会在 Tomcat 优雅停机前释放。 */
class SubagentTaskStreamServiceTest {

    @Test
    void closesInfiniteTaskStreamsWhenApplicationContextIsClosing() throws Exception {
        SubagentTaskStreamService service = new SubagentTaskStreamService();
        SseEmitter emitter = service.subscribe("owner", "session", List.of());

        assertEquals(1, service.subscriberCount());

        service.onApplicationContextClosed();

        assertEquals(0, service.subscriberCount());
        assertThrows(IllegalStateException.class,
                () -> emitter.send(SseEmitter.event().name("task").data("late-event")));

        SseEmitter lateEmitter = service.subscribe("owner", "late-session", List.of());
        assertEquals(0, service.subscriberCount());
        assertThrows(IllegalStateException.class,
                () -> lateEmitter.send(SseEmitter.event().name("task").data("late-event")));
    }
}
