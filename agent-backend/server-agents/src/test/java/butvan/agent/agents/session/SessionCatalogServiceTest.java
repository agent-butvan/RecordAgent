package butvan.agent.agents.session;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.agents.session.dto.CreateSessionRequest;
import butvan.agent.agents.session.dto.SessionKind;
import butvan.agent.agents.session.dto.SessionPermissionMode;
import butvan.agent.agents.session.dto.SessionSummaryDto;
import butvan.agent.agents.storage.AgentStorageProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SessionCatalogServiceTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void generatedTitleNeverOverridesManualRenameAndPermissionPersists() {
        AgentStorageProperties storage = new AgentStorageProperties(temporaryDirectory.resolve("data-1"));
        CurrentUserProvider user = new CurrentUserProvider();
        SessionCatalogService service = new SessionCatalogService(
                storage,
                user,
                new ObjectMapper().findAndRegisterModules()
        );

        SessionSummaryDto created = service.create(new CreateSessionRequest(SessionKind.GENERAL, "新对话"));
        service.updateTitle(created.id(), "我手动设置的标题");
        SessionSummaryDto result = service.updateGeneratedTitle(created.id(), "模型生成标题");
        service.updatePermissionMode(created.id(), SessionPermissionMode.AUTO_EDIT);

        assertEquals("我手动设置的标题", result.title());
        assertEquals(SessionPermissionMode.AUTO_EDIT, service.getPermissionMode(created.id()));
    }

    @Test
    void defaultSessionAcceptsGeneratedTitleOnlyOnce() {
        AgentStorageProperties storage = new AgentStorageProperties(temporaryDirectory.resolve("data-2"));
        CurrentUserProvider user = new CurrentUserProvider();
        SessionCatalogService service = new SessionCatalogService(
                storage,
                user,
                new ObjectMapper().findAndRegisterModules()
        );

        SessionSummaryDto created = service.create(new CreateSessionRequest(SessionKind.GENERAL, "新对话"));
        assertEquals("首个模型标题", service.updateGeneratedTitle(created.id(), "首个模型标题").title());
        assertEquals("首个模型标题", service.updateGeneratedTitle(created.id(), "第二个模型标题").title());
        assertEquals(SessionPermissionMode.ASK, service.getPermissionMode(created.id()));
    }
}
