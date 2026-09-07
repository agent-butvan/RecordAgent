package butvan.agent.agents.agent.run;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.agents.session.SessionCatalogService;
import butvan.agent.agents.session.TranscriptService;
import butvan.agent.agents.session.dto.CreateSessionRequest;
import butvan.agent.agents.session.dto.SessionKind;
import butvan.agent.agents.session.dto.TranscriptMessageDto;
import butvan.agent.agents.storage.AgentStorageProperties;
import butvan.agent.agents.usage.ModelIdentity;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.event.ModelCallEndEvent;
import io.agentscope.core.event.ModelCallStartEvent;
import io.agentscope.core.model.ChatUsage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AgentRunRecoveryServiceTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void restoresInterruptedRunAsCancelledMessageWithUsage() {
        Fixture fixture = fixture("data-1");
        String sessionId = fixture.catalog.create(
                new CreateSessionRequest(SessionKind.GENERAL, "新对话")).id();
        AgentRun run = run(sessionId, "turn-1");
        ModelIdentity model = new ModelIdentity("openai", "gpt-test");
        run.recordModelEvent(new ModelCallStartEvent("call-1"), model);
        run.recordModelEvent(new ModelCallEndEvent("call-1", ChatUsage.builder()
                .inputTokens(20).outputTokens(5).time(0.3).build()), model);
        fixture.checkpoints.save(run);

        fixture.recovery.recoverInterruptedRuns();

        TranscriptMessageDto restored = fixture.transcript.list(sessionId).getFirst();
        assertAll(
                () -> assertEquals(TranscriptMessageDto.MessageStatus.CANCELLED, restored.status()),
                () -> assertEquals(25, restored.usage().totalTokens()),
                () -> assertTrue(fixture.checkpoints.list().isEmpty())
        );
    }

    @Test
    void removesStaleCheckpointWithoutDuplicatingExistingAssistantTurn() {
        Fixture fixture = fixture("data-2");
        String sessionId = fixture.catalog.create(
                new CreateSessionRequest(SessionKind.GENERAL, "新对话")).id();
        AgentRun run = run(sessionId, "turn-2");
        fixture.checkpoints.save(run);
        fixture.transcript.appendAssistantMessage(
                sessionId, "turn-2", "已完成", null,
                TranscriptMessageDto.MessageStatus.COMPLETED, 1L, java.util.List.of(), run.tokenUsage());

        fixture.recovery.recoverInterruptedRuns();

        assertAll(
                () -> assertEquals(1, fixture.transcript.list(sessionId).size()),
                () -> assertTrue(fixture.checkpoints.list().isEmpty())
        );
    }

    private AgentRun run(String sessionId, String turnId) {
        return new AgentRun(sessionId, "local-default", turnId,
                RuntimeContext.builder().userId("local-default").sessionId(sessionId).build());
    }

    private Fixture fixture(String directory) {
        AgentStorageProperties storage = new AgentStorageProperties(temporaryDirectory.resolve(directory));
        ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
        TranscriptService transcript = new TranscriptService(storage, mapper);
        SessionCatalogService catalog = new SessionCatalogService(storage, new CurrentUserProvider(), mapper);
        AgentRunCheckpointService checkpoints = new AgentRunCheckpointService(storage, mapper);
        return new Fixture(transcript, catalog, checkpoints,
                new AgentRunRecoveryService(checkpoints, transcript, catalog));
    }

    private record Fixture(
            TranscriptService transcript,
            SessionCatalogService catalog,
            AgentRunCheckpointService checkpoints,
            AgentRunRecoveryService recovery
    ) {
    }
}
