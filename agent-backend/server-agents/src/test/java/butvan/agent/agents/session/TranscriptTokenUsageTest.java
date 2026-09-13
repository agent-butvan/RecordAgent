package butvan.agent.agents.session;

import butvan.agent.agents.agent.AgentRunCompleter;
import butvan.agent.agents.agent.run.AgentRun;
import butvan.agent.agents.agent.run.AgentRunCheckpointService;
import butvan.agent.agents.identity.CurrentUserProvider;
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

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class TranscriptTokenUsageTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void persistsUsageOnceWhenMultipleCompletionPathsRace() {
        Fixture fixture = fixture("data-1");
        String sessionId = fixture.catalog().create(
                new CreateSessionRequest(SessionKind.GENERAL, "新对话")
        ).id();
        AgentRun run = new AgentRun(sessionId, "local-default", "turn-1",
                RuntimeContext.builder().userId("local-default").sessionId(sessionId).build());
        ModelIdentity model = new ModelIdentity("openai", "gpt-test");
        run.recordModelEvent(new ModelCallStartEvent("call-1"), model);
        run.recordModelEvent(new ModelCallEndEvent("call-1", ChatUsage.builder()
                .inputTokens(25).outputTokens(7).cachedTokens(5).time(0.4).build()), model);

        AgentRunCompleter completer = new AgentRunCompleter(
                fixture.transcript(), fixture.catalog(),
                new AgentRunCheckpointService(fixture.storage(), fixture.mapper())
        );
        completer.complete(run, TranscriptMessageDto.MessageStatus.COMPLETED);
        completer.complete(run, TranscriptMessageDto.MessageStatus.FAILED);

        var messages = fixture.transcript().list(sessionId);
        assertAll(
                () -> assertEquals(1, messages.size()),
                () -> assertEquals(TranscriptMessageDto.MessageStatus.COMPLETED,
                        messages.getFirst().status()),
                () -> assertEquals(32, messages.getFirst().usage().totalTokens()),
                () -> assertEquals(5, messages.getFirst().usage().cachedInputTokens())
        );
    }

    @Test
    void persistsCancelledMessageWhenProducerWasInterrupted() {
        Fixture fixture = fixture("data-cancelled");
        String sessionId = fixture.catalog().create(
                new CreateSessionRequest(SessionKind.GENERAL, "新对话")
        ).id();
        AgentRun run = new AgentRun(sessionId, "local-default", "turn-cancelled",
                RuntimeContext.builder().userId("local-default").sessionId(sessionId).build());
        AgentRunCompleter completer = new AgentRunCompleter(
                fixture.transcript(), fixture.catalog(),
                new AgentRunCheckpointService(fixture.storage(), fixture.mapper())
        );

        Thread.currentThread().interrupt();
        try {
            completer.complete(run, TranscriptMessageDto.MessageStatus.CANCELLED);
        } finally {
            // 不把本测试的中断标记泄漏给同一 JUnit worker 线程。
            Thread.interrupted();
        }

        assertEquals(TranscriptMessageDto.MessageStatus.CANCELLED,
                fixture.transcript().list(sessionId).getFirst().status());
    }

    @Test
    void readsLegacyTranscriptWithoutUsageField() throws Exception {
        Fixture fixture = fixture("data-2");
        String sessionId = "legacy-session";
        String legacyLine = """
                {"id":"message-1","turnId":"turn-1","role":"ASSISTANT","content":"旧消息",\
                "createdAt":"2026-09-07T00:00:00Z","status":"COMPLETED",\
                "durationMillis":100,"tools":[],"thinking":null}
                """.replace("\n", "");
        Files.writeString(fixture.storage().transcriptFile(sessionId), legacyLine + System.lineSeparator(),
                StandardCharsets.UTF_8);

        TranscriptMessageDto message = fixture.transcript().list(sessionId).getFirst();

        assertAll(
                () -> assertEquals("旧消息", message.content()),
                () -> assertNull(message.usage())
        );
    }

    private Fixture fixture(String directory) {
        AgentStorageProperties storage = new AgentStorageProperties(temporaryDirectory.resolve(directory));
        ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
        CurrentUserProvider user = new CurrentUserProvider();
        return new Fixture(
                storage,
                mapper,
                new TranscriptService(storage, mapper),
                new SessionCatalogService(storage, user, mapper)
        );
    }

    private record Fixture(
            AgentStorageProperties storage,
            ObjectMapper mapper,
            TranscriptService transcript,
            SessionCatalogService catalog
    ) {
    }
}
