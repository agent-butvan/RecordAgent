package butvan.agent.agents.agent.permission;

import butvan.agent.agents.agent.run.AgentRun;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import io.agentscope.core.message.ToolUseBlock;
import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** 管理未完成审批及“仅当前会话”的精确授权记忆。 */
@Component
public class PendingApprovalStore {
    private final Map<String, PendingApproval> approvals = new ConcurrentHashMap<>();
    private final Map<String, Boolean> sessionDecisions = new ConcurrentHashMap<>();
    private final ObjectMapper canonicalJson = new ObjectMapper()
            .configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true);

    public void save(PendingApproval approval) {
        approvals.put(approval.approvalId(), approval);
    }

    /** 同时校验 approvalId、用户和会话，不能只相信前端传来的 UUID。 */
    public PendingApproval require(String approvalId, String userId, String sessionId) {
        PendingApproval approval = Optional.ofNullable(approvals.get(approvalId))
                .orElseThrow(() -> new IllegalArgumentException("确认请求不存在或已失效"));
        if (approval.expired()) {
            approvals.remove(approvalId);
            throw new IllegalArgumentException("确认请求已超时，请重新发起任务");
        }
        AgentRun run = approval.run();
        if (!run.userId().equals(userId) || !run.sessionId().equals(sessionId)) {
            throw new IllegalArgumentException("无权操作此确认请求");
        }
        return approval;
    }

    public void remember(String userId, String sessionId, ToolUseBlock tool, boolean approved) {
        sessionDecisions.put(key(userId, sessionId, tool), approved);
    }

    public Optional<Boolean> remembered(String userId, String sessionId, ToolUseBlock tool) {
        return Optional.ofNullable(sessionDecisions.get(key(userId, sessionId, tool)));
    }

    public void remove(String approvalId) {
        approvals.remove(approvalId);
    }

    /** 判断某会话是否仍有未完成的权限确认（供飞书等非桌面渠道在运行前提示用户）。 */
    public boolean hasPending(String userId, String sessionId) {
        return approvals.values().stream()
                .anyMatch(approval -> !approval.expired()
                        && approval.run().userId().equals(userId)
                        && approval.run().sessionId().equals(sessionId));
    }

    /** 会话被删除或用户显式清空会话时必须调用，避免内存长期累积。 */
    public void clearSession(String userId, String sessionId) {
        String prefix = userId + ":" + sessionId + ":";
        sessionDecisions.keySet().removeIf(key -> key.startsWith(prefix));
    }

    private String key(String userId, String sessionId, ToolUseBlock tool) {
        try {
            String json = canonicalJson.writeValueAsString(tool.getInput());
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest((tool.getName() + "\n" + json).getBytes(StandardCharsets.UTF_8));
            return userId + ":" + sessionId + ":" + java.util.HexFormat.of().formatHex(digest);
        } catch (Exception exception) {
            throw new IllegalStateException("无法生成工具授权指纹", exception);
        }
    }
}
