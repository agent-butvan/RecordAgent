package butvan.agent.agents.agent;

import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.message.ToolUseBlock;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 覆盖飞书全权限渠道使用的自动批准与挂起查询逻辑。
 */
class PendingApprovalStoreTest {

    @Test
    void approveAllDecidesEveryTool() {
        AgentRun run = new AgentRun("session-1", "local-default", "turn-1",
                RuntimeContext.builder().userId("local-default").sessionId("session-1").build());
        PendingApproval approval = new PendingApproval(run, List.of(
                new ToolUseBlock("call-1", "execute", Map.of("command", "ls")),
                new ToolUseBlock("call-2", "write_file", Map.of("path", "/tmp/a.txt"))));

        approval.approveAll();

        assertTrue(approval.allDecided());
        assertTrue(approval.toConfirmResults().stream().allMatch(result -> result.isConfirmed()));
        assertFalse(approval.expired());
    }

    @Test
    void hasPendingMatchesSessionAndUser() {
        AgentRun run = new AgentRun("session-1", "local-default", "turn-1",
                RuntimeContext.builder().userId("local-default").sessionId("session-1").build());
        PendingApprovalStore store = new PendingApprovalStore();
        store.save(new PendingApproval(run, List.of(
                new ToolUseBlock("call-1", "execute", Map.of("command", "ls")))));

        assertTrue(store.hasPending("local-default", "session-1"));
        assertFalse(store.hasPending("local-default", "session-2"));
        assertFalse(store.hasPending("other-user", "session-1"));
    }
}
