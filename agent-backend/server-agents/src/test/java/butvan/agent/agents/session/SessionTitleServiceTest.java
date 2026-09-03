package butvan.agent.agents.session;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.agents.session.dto.CreateSessionRequest;
import butvan.agent.agents.session.dto.SessionKind;
import butvan.agent.agents.session.dto.SessionSummaryDto;
import butvan.agent.agents.storage.AgentStorageProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SessionTitleServiceTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void generatesFromFirstUserQuestionAndCleansModelDecoration() {
        Fixture fixture = fixture("data-1", question -> "“优化模型配置界面。”");
        SessionSummaryDto session = fixture.catalog.create(new CreateSessionRequest(SessionKind.GENERAL, "新对话"));
        fixture.transcript.appendUserMessage(session.id(), "帮我优化模型配置界面");

        assertEquals("优化模型配置界面", fixture.titleService.generateIfNeeded(session.id()).title());
    }

    @Test
    void skipsGenerationWhenSessionWasAlreadyRenamed() {
        Fixture fixture = fixture("data-2", question -> {
            throw new AssertionError("手动标题不应再次调用模型");
        });
        SessionSummaryDto session = fixture.catalog.create(new CreateSessionRequest(SessionKind.GENERAL, "新对话"));
        fixture.transcript.appendUserMessage(session.id(), "这是首个问题");
        fixture.catalog.updateTitle(session.id(), "手动标题");

        assertEquals("手动标题", fixture.titleService.generateIfNeeded(session.id()).title());
    }

    private Fixture fixture(String directory, ConversationTitleGenerator generator) {
        AgentStorageProperties storage = new AgentStorageProperties(temporaryDirectory.resolve(directory));
        ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
        SessionCatalogService catalog = new SessionCatalogService(storage, new CurrentUserProvider(), mapper);
        TranscriptService transcript = new TranscriptService(storage, mapper);
        return new Fixture(catalog, transcript, new SessionTitleService(catalog, transcript, generator));
    }

    private record Fixture(
            SessionCatalogService catalog,
            TranscriptService transcript,
            SessionTitleService titleService
    ) {
    }
}
