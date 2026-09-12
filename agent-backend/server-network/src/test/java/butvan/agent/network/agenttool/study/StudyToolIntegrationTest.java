package butvan.agent.network.agenttool.study;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.agents.tool.result.ToolResult;
import butvan.agent.network.agenttool.common.BusinessToolExecutor;
import butvan.agent.network.agenttool.study.StudyTool.ManualRequest;
import butvan.agent.network.agenttool.study.StudyTool.QueryRequest;
import butvan.agent.network.agenttool.study.StudyTool.SessionQueryResult;
import butvan.agent.network.agenttool.study.StudyTool.StartRequest;
import butvan.agent.network.agenttool.study.StudyTool.UpdateRequest;
import butvan.agent.network.agenttool.study.StudyTool.VersionedRequest;
import butvan.agent.network.config.database.LocalDatabaseConfiguration;
import butvan.agent.network.daily.repository.DailyEventRepository;
import butvan.agent.network.daily.type.DailyEventTypeRegistry;
import butvan.agent.network.daily.type.StudyTypeHandler;
import butvan.agent.network.study.model.StudyModels.StudySession;
import butvan.agent.network.study.model.StudyModels.StudyStatistics;
import butvan.agent.network.study.repository.StudyRepository;
import butvan.agent.network.study.service.StudyService;
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
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(classes = {
        LocalDatabaseConfiguration.class,
        JacksonAutoConfiguration.class,
        DailyEventRepository.class,
        DailyEventTypeRegistry.class,
        StudyTypeHandler.class,
        StudyRepository.class,
        StudyService.class,
        BusinessToolExecutor.class,
        CurrentUserProvider.class,
        StudyTool.class
})
class StudyToolIntegrationTest {
    private static final Path DATABASE_PATH = createDatabasePath();

    @Autowired
    private StudyTool studyTool;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("butvan.database.path", DATABASE_PATH::toString);
    }

    @Test
    void exposesStudyToolSchemas() {
        Toolkit toolkit = new Toolkit();
        toolkit.registerTool(studyTool);
        assertEquals(Set.of("study_query", "study_start", "study_finish", "study_create_manual",
                "study_update", "study_delete"), toolkit.getToolNames());
    }

    @Test
    void supportsActiveSessionLifecycle() {
        StudySession started = assertInstanceOf(StudySession.class, studyTool.start(new StartRequest(
                "学习 AgentScope", "系统设计", "Asia/Shanghai", "study-start")).data());
        ToolResult<?> duplicate = studyTool.start(new StartRequest(
                "重复学习", "其他", "Asia/Shanghai", "study-start-second"));
        assertFalse(duplicate.success());
        assertEquals("ACTIVE_SESSION_EXISTS", duplicate.error().code());

        StudySession active = assertInstanceOf(StudySession.class,
                studyTool.query(new QueryRequest("active", null, null, null, null)).data());
        assertEquals(started.id(), active.id());
        StudySession finished = assertInstanceOf(StudySession.class, studyTool.finish(new VersionedRequest(
                started.id(), started.version(), "study-finish")).data());
        assertEquals("completed", finished.status());
        assertNull(studyTool.query(new QueryRequest("active", null, null, null, null)).data());
    }

    @Test
    void supportsManualQueryUpdateStatisticsAndDelete() {
        StudySession created = assertInstanceOf(StudySession.class, studyTool.createManual(new ManualRequest(
                "复习数据库", "后端", "2026-09-10T01:00:00Z", "2026-09-10T02:00:00Z",
                "Asia/Shanghai", "图书馆", "study-manual")).data());

        SessionQueryResult sessions = assertInstanceOf(SessionQueryResult.class, studyTool.query(new QueryRequest(
                "sessions", "2026-09-10", "2026-09-10", "Asia/Shanghai", 20)).data());
        assertTrue(sessions.items().stream().anyMatch(item -> item.id().equals(created.id())));

        StudyStatistics statistics = assertInstanceOf(StudyStatistics.class, studyTool.query(new QueryRequest(
                "statistics", "2026-09-10", "2026-09-10", "Asia/Shanghai", null)).data());
        assertEquals(3600, statistics.totalDurationSeconds());

        StudySession updated = assertInstanceOf(StudySession.class, studyTool.update(new UpdateRequest(
                created.id(), created.version(), "复习 SQLite", null, null, "2026-09-10T02:30:00Z",
                null, "自习室", "study-update")).data());
        assertEquals(5400, updated.durationSeconds());
        assertEquals("自习室", updated.location());

        ToolResult<?> staleDelete = studyTool.delete(new VersionedRequest(
                created.id(), created.version(), "study-delete-stale"));
        assertFalse(staleDelete.success());
        assertEquals("VERSION_CONFLICT", staleDelete.error().code());
        assertTrue(studyTool.delete(new VersionedRequest(
                created.id(), updated.version(), "study-delete")).success());
    }

    private static Path createDatabasePath() {
        try {
            return Files.createTempDirectory("butvan-study-tool-test-").resolve("butvan.db");
        } catch (IOException exception) {
            throw new IllegalStateException("无法创建学习工具测试数据库", exception);
        }
    }
}
