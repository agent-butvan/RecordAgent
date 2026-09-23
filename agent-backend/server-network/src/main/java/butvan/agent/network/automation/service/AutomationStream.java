package butvan.agent.network.automation.service;

import butvan.agent.network.automation.event.TasksChanged;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.ContextClosedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.io.IOException;

/** 事务提交后发布权威快照，建连与写入使用同一领域监视器保证事件顺序。 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AutomationStream {
    private final AutomationService tasks;
    private final Map<String, Set<SseEmitter>> clients = new ConcurrentHashMap<>();
    private boolean closing;
    /** 连接及重连先发送快照，无前端轮询。 */
    public SseEmitter subscribe(String owner) {
        var emitter = new SseEmitter(120_000L);
        Runnable remove = () -> { var set = clients.get(owner); if (set != null) set.remove(emitter); };
        emitter.onCompletion(remove); emitter.onTimeout(remove); emitter.onError(e -> remove.run());
        synchronized (tasks) {
            if (closing) { emitter.complete(); return emitter; }
            clients.computeIfAbsent(owner, ignored -> ConcurrentHashMap.newKeySet()).add(emitter);
            send(owner, emitter);
        }
        return emitter;
    }
    /** 数据已经提交，广播失败不能把写入伪装为失败。 */
    @TransactionalEventListener
    public void changed(TasksChanged event) {
        synchronized (tasks) {
            try { for (var emitter : clients.getOrDefault(event.ownerId(), Set.of())) send(event.ownerId(), emitter); }
            catch (RuntimeException e) { log.warn("任务快照广播失败：{}", e.getClass().getSimpleName()); }
        }
    }
    private void send(String owner, SseEmitter emitter) {
        try { emitter.send(SseEmitter.event().name("snapshot").data(tasks.snapshot(owner))); }
        catch (IOException | IllegalStateException e) {
            log.debug("任务事件客户端已断开");
            clients.getOrDefault(owner, Set.of()).remove(emitter); emitter.complete();
        }
    }
    /** 避免无限连接阻塞应用退出。 */
    @EventListener(ContextClosedEvent.class)
    public void close() {
        synchronized (tasks) { closing = true; clients.values().forEach(set -> set.forEach(SseEmitter::complete)); clients.clear(); }
    }
}
