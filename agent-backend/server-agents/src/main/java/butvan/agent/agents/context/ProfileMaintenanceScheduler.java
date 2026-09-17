package butvan.agent.agents.context;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** 在聊天完成后以单用户去重的虚拟线程触发低频画像检查。 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ProfileMaintenanceScheduler {

    private final ProfileMaintenanceService maintenanceService;
    private final Set<String> runningUsers = ConcurrentHashMap.newKeySet();

    /** 非阻塞触发；同一用户已有后台检查时直接跳过。 */
    public void consider(String userId) {
        if (!runningUsers.add(userId)) return;
        Thread.startVirtualThread(() -> {
            try {
                maintenanceService.checkIfDue(userId);
            } catch (RuntimeException exception) {
                log.warn("画像辅助维护检查失败，不影响当前对话：userId={}", userId, exception);
            } finally {
                runningUsers.remove(userId);
            }
        });
    }
}
