package butvan.agent.network.chat.service;

import butvan.agent.network.chat.dto.AgentAnalysisContextRequest;
import butvan.agent.network.chat.dto.AgentChatRequest;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;

/** 验证业务数据进入模型前不可绕过的协议与隐私边界。 */
class AgentAnalysisContextServiceTest {
    private final AgentAnalysisContextService service = new AgentAnalysisContextService(null, null, null, null);

    @Test
    void requiresPerRequestConsentForEveryCommandContainingFinanceData() {
        for (String command : List.of("daily-review", "weekly-review", "finance-review")) {
            AgentAnalysisContextRequest analysis = new AgentAnalysisContextRequest(
                    command, "2026-09-11", "Asia/Shanghai", false);
            assertThrows(IllegalArgumentException.class, () -> service.prepare("owner",
                    new AgentChatRequest("session", "/" + command, "", List.of(), analysis)));
        }
    }

    @Test
    void rejectsAmbiguousRecordAndBusinessContexts() {
        AgentAnalysisContextRequest analysis = new AgentAnalysisContextRequest(
                "todo-review", "week", "Asia/Shanghai", false);
        assertThrows(IllegalArgumentException.class, () -> service.prepare("owner",
                new AgentChatRequest("session", "/todo-review", "", List.of("record-id"), analysis)));
    }

    @Test
    void rejectsUnknownAnalysisCommandBeforeReadingBusinessData() {
        AgentAnalysisContextRequest analysis = new AgentAnalysisContextRequest(
                "unknown", "week", "Asia/Shanghai", true);
        assertThrows(IllegalArgumentException.class, () -> service.prepare("owner",
                new AgentChatRequest("session", "/unknown", "", List.of(), analysis)));
    }
}
