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
import butvan.agent.agents.usage.TurnTokenUsage;
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
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
    void reportsTranscriptFailureAndRetainsCheckpointForRecovery() {
        Fixture fixture = fixture("data-write-failure");
        String sessionId = fixture.catalog().create(
                new CreateSessionRequest(SessionKind.GENERAL, "新对话")
        ).id();
        String turnId = "turn-write-failure";
        AgentRun run = new AgentRun(sessionId, "local-default", turnId,
                RuntimeContext.builder().userId("local-default").sessionId(sessionId).build());
        AgentRunCheckpointService checkpoints =
                new AgentRunCheckpointService(fixture.storage(), fixture.mapper());
        checkpoints.save(run);
        TranscriptService failingTranscript = new TranscriptService(fixture.storage(), fixture.mapper()) {
            @Override
            public synchronized void appendAssistantMessage(
                    String ignoredSessionId,
                    String ignoredTurnId,
                    String content,
                    String thinking,
                    TranscriptMessageDto.MessageStatus status,
                    Long durationMillis,
                    List<TranscriptMessageDto.ToolExecutionDto> tools,
                    TurnTokenUsage usage
            ) {
                throw new IllegalArgumentException("模拟磁盘写入失败");
            }
        };
        AgentRunCompleter completer = new AgentRunCompleter(
                failingTranscript, fixture.catalog(), checkpoints);

        assertFalse(completer.tryComplete(run, TranscriptMessageDto.MessageStatus.CANCELLED));
        assertTrue(Files.exists(fixture.storage().runCheckpointFile(turnId)));
    }

    @Test
    void catalogRefreshFailureDoesNotInvalidatePersistedTerminalMessage() {
        Fixture fixture = fixture("data-catalog-failure");
        String sessionId = fixture.catalog().create(
                new CreateSessionRequest(SessionKind.GENERAL, "新对话")
        ).id();
        AgentRun run = new AgentRun(sessionId, "local-default", "turn-catalog-failure",
                RuntimeContext.builder().userId("local-default").sessionId(sessionId).build());
        SessionCatalogService failingCatalog = new SessionCatalogService(
                fixture.storage(), new CurrentUserProvider(), fixture.mapper()) {
            @Override
            public synchronized void touch(String ignoredSessionId, String assistantContent) {
                throw new IllegalArgumentException("模拟目录册刷新失败");
            }
        };
        AgentRunCompleter completer = new AgentRunCompleter(
                fixture.transcript(), failingCatalog,
                new AgentRunCheckpointService(fixture.storage(), fixture.mapper()));

        assertTrue(completer.tryComplete(run, TranscriptMessageDto.MessageStatus.COMPLETED));
        assertEquals(TranscriptMessageDto.MessageStatus.COMPLETED,
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
