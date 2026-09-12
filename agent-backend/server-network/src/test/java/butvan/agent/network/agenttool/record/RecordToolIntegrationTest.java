package butvan.agent.network.agenttool.record;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.agents.tool.result.ToolResult;
import butvan.agent.network.agenttool.common.BusinessToolExecutor;
import butvan.agent.network.agenttool.record.RecordTool.CreateRequest;
import butvan.agent.network.agenttool.record.RecordTool.ReadRequest;
import butvan.agent.network.agenttool.record.RecordTool.RecycleRequest;
import butvan.agent.network.agenttool.record.RecordTool.SearchRequest;
import butvan.agent.network.agenttool.record.RecordTool.SearchResult;
import butvan.agent.network.agenttool.record.RecordTool.UpdateRequest;
import butvan.agent.network.config.database.LocalDatabaseConfiguration;
import butvan.agent.network.daily.DailyEventModuleConfiguration;
import butvan.agent.network.record.model.RecordModels.RecordEntry;
import butvan.agent.network.record.repository.RecordRepository;
import butvan.agent.network.record.service.RecordService;
import butvan.agent.network.record.service.RecordTabService;
import io.agentscope.core.tool.Toolkit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(classes = {
        LocalDatabaseConfiguration.class,
        JacksonAutoConfiguration.class,
        DailyEventModuleConfiguration.class,
        RecordRepository.class,
        RecordTabService.class,
        RecordService.class,
        BusinessToolExecutor.class,
        CurrentUserProvider.class,
        RecordTool.class
})
class RecordToolIntegrationTest {
    private static final Path DATABASE_PATH = createDatabasePath();

    @Autowired
    private RecordTool recordTool;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("butvan.database.path", DATABASE_PATH::toString);
    }

    @Test
    void exposesRecordToolSchemas() {
        Toolkit toolkit = new Toolkit();
        toolkit.registerTool(recordTool);
        assertEquals(Set.of("record_search", "record_read", "record_create", "record_update", "record_recycle"),
                toolkit.getToolNames());
    }

    @Test
    void recordsCanBeCreatedSearchedUpdatedTrashedAndRestored() {
        CreateRequest create = new CreateRequest(
                "2026-09-12", "learning", "Agent Tool 笔记", "第一行\n第二行", List.of("智能体"),
                null, "record-create");
        RecordEntry created = assertInstanceOf(RecordEntry.class, recordTool.create(create).data());
        Map<?, ?> duplicate = assertInstanceOf(Map.class, recordTool.create(create).data());
        assertEquals(created.id(), duplicate.get("id"));
        assertEquals("<p>第一行<br>第二行</p>", created.contentHtml());

        ToolResult<?> searchResult = recordTool.search(new SearchRequest(
                "2026-09-01", "2026-09-30", "learning", "智能体", "Tool", null, 20));
        SearchResult matches = assertInstanceOf(SearchResult.class, searchResult.data());
        assertEquals(1, matches.items().size());
        assertFalse(matches.truncated());

        RecordEntry read = assertInstanceOf(RecordEntry.class,
                recordTool.read(new ReadRequest(created.id())).data());
        assertEquals(created.id(), read.id());

        RecordEntry updated = assertInstanceOf(RecordEntry.class, recordTool.update(new UpdateRequest(
                created.id(), created.version(), null, null, "Agent Tool 更新", null, null,
                null, true, null, null, "record-update")).data());
        assertEquals("Agent Tool 更新", updated.title());
        assertTrue(updated.pinned());

        RecordEntry trashed = assertInstanceOf(RecordEntry.class, recordTool.recycle(new RecycleRequest(
                created.id(), updated.version(), "trash", "record-trash")).data());
        ToolResult<?> unavailable = recordTool.read(new ReadRequest(created.id()));
        assertFalse(unavailable.success());

        RecordEntry restored = assertInstanceOf(RecordEntry.class, recordTool.recycle(new RecycleRequest(
                created.id(), trashed.version(), "restore", "record-restore")).data());
        assertEquals(created.id(), restored.id());
        assertTrue(recordTool.read(new ReadRequest(created.id())).success());
    }

    private static Path createDatabasePath() {
        try {
            return Files.createTempDirectory("butvan-record-tool-test-").resolve("butvan.db");
        } catch (IOException exception) {
            throw new IllegalStateException("无法创建资料工具测试数据库", exception);
        }
    }
}
