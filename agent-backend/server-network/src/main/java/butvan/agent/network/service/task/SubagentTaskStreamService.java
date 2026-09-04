package butvan.agent.network.service.task;

import butvan.agent.agents.subagent.event.SubagentTaskLifecycleEvent;
import butvan.agent.network.dto.SubagentTaskResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * 管理会话级后台任务 SSE 订阅，并将任务领域事件转发给对应桌面端。
 */
@Slf4j
@Service
public class SubagentTaskStreamService {

    private final ConcurrentMap<SubscriptionKey, Set<SseEmitter>> subscribers = new ConcurrentHashMap<>();

    /**
     * 建立任务状态订阅，并先发送当前任务快照以支持页面重载和 SSE 自动重连。
     */
    public SseEmitter subscribe(
            String userId, String sessionId, List<SubagentTaskResponse> initialSnapshot) {
        SubscriptionKey key = new SubscriptionKey(userId, sessionId);
        SseEmitter emitter = new SseEmitter(0L);
        subscribers.computeIfAbsent(key, ignored -> ConcurrentHashMap.newKeySet()).add(emitter);
        emitter.onCompletion(() -> unsubscribe(key, emitter));
        emitter.onTimeout(() -> unsubscribe(key, emitter));
        send(key, emitter, "snapshot", initialSnapshot);
        return emitter;
    }

    /** 将后台任务状态变化只推送给同一用户、同一会话的订阅者。 */
    @EventListener
    public void onTaskLifecycleChanged(SubagentTaskLifecycleEvent event) {
        SubscriptionKey key = new SubscriptionKey(event.userId(), event.sessionId());
        SubagentTaskResponse payload = new SubagentTaskResponse(
                event.taskId(), event.status(), event.result(), event.error());
        Set<SseEmitter> emitters = subscribers.get(key);
        if (emitters != null) {
            emitters.forEach(emitter -> send(key, emitter, "task", payload));
        }
    }

    private void send(SubscriptionKey key, SseEmitter emitter, String eventName, Object payload) {
        try {
            emitter.send(SseEmitter.event().name(eventName).data(payload));
        } catch (IOException | IllegalStateException exception) {
            log.debug("后台任务 SSE 客户端已断开：sessionId={}", key.sessionId(), exception);
            unsubscribe(key, emitter);
            emitter.complete();
        }
    }

    private void unsubscribe(SubscriptionKey key, SseEmitter emitter) {
        Set<SseEmitter> emitters = subscribers.get(key);
        if (emitters == null) return;
        emitters.remove(emitter);
        if (emitters.isEmpty()) {
            subscribers.remove(key, emitters);
        }
    }

    private record SubscriptionKey(String userId, String sessionId) {
    }
}
