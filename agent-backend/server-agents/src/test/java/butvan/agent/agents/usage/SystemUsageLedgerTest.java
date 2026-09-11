package butvan.agent.agents.usage;

import butvan.agent.agents.storage.AgentStorageProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.agentscope.core.model.ChatUsage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;

class SystemUsageLedgerTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void appendsReportedAndUnavailableCallsAndDeletesOnlyTargetSession() {
        SystemUsageLedger ledger = ledger();
        ledger.append("session-1", UsagePurpose.SESSION_TITLE, "call-1",
                new ModelIdentity("openai", "gpt-test"),
                ChatUsage.builder().inputTokens(12).outputTokens(4).cachedTokens(3).time(0.2).build());
        ledger.append("session-1", UsagePurpose.SESSION_TITLE, "call-2",
                new ModelIdentity("openai", "gpt-test"), null);
        ledger.append("session-2", UsagePurpose.SESSION_TITLE, "call-3",
                new ModelIdentity("anthropic", "claude-test"),
                ChatUsage.builder().inputTokens(8).outputTokens(2).time(0.1).build());

        var records = ledger.list();
        assertAll(
                () -> assertEquals(3, records.size()),
                () -> assertEquals(16, records.getFirst().usage().totalTokens()),
                () -> assertEquals(3, records.getFirst().usage().cachedInputTokens()),
                () -> assertEquals(UsageStatus.UNAVAILABLE, records.get(1).usage().status())
        );

        ledger.deleteSession("session-1");

        assertAll(
                () -> assertEquals(1, ledger.list().size()),
                () -> assertEquals("session-2", ledger.list().getFirst().sessionId())
        );
    }

    private SystemUsageLedger ledger() {
        AgentStorageProperties storage = new AgentStorageProperties(temporaryDirectory.resolve("data"));
        return new SystemUsageLedger(storage, new ObjectMapper().findAndRegisterModules());
    }
}
