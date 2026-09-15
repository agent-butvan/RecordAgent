package butvan.agent.network.study.controller;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.network.config.database.LocalDatabaseConfiguration;
import butvan.agent.network.controller.ApiExceptionHandler;
import butvan.agent.network.daily.repository.DailyEventRepository;
import butvan.agent.network.daily.type.DailyEventTypeRegistry;
import butvan.agent.network.daily.type.StudyTypeHandler;
import butvan.agent.network.study.event.StudySessionChangedEvent;
import butvan.agent.network.study.repository.StudyRepository;
import butvan.agent.network.study.service.StudyService;
import butvan.agent.network.study.service.StudySessionStreamService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.hamcrest.Matchers.hasItem;
import static org.junit.jupiter.api.Assertions.assertEquals;

/** 通过 HTTP seam 验证学习打卡、补卡、统计与并发版本。 */
@SpringBootTest(classes = StudyApiIntegrationTest.TestApplication.class)
@AutoConfigureMockMvc
@RecordApplicationEvents
class StudyApiIntegrationTest {
    private static final Path DATABASE_PATH = createDatabasePath();

    @jakarta.annotation.Resource
    private MockMvc mockMvc;

    @jakarta.annotation.Resource
    private ApplicationEvents applicationEvents;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("butvan.database.path", DATABASE_PATH::toString);
    }

    @Test
    void startAndFinishMaintainsSingleActiveSession() throws Exception {
        JsonNode started = data(postJson("/agent/study-sessions/start", """
                {"content":"学习八股文","category":"系统设计","timezone":"Asia/Shanghai"}
                """));

        mockMvc.perform(post("/agent/study-sessions/start")
                        .contentType("application/json")
                        .content("""
                                {"content":"写算法","category":"算法","timezone":"Asia/Shanghai"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));

        mockMvc.perform(post("/agent/study-sessions/{id}/finish", started.path("id").asText())
                        .param("expectedVersion", String.valueOf(started.path("version").asInt())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("completed"))
                .andExpect(jsonPath("$.data.endedAt").isNotEmpty());

        mockMvc.perform(get("/agent/study-sessions/active"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").doesNotExist());

        mockMvc.perform(get("/agent/study-sessions/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasItem("系统设计")));

        assertEquals(
                java.util.List.of(
                        StudySessionChangedEvent.ChangeType.STARTED,
                        StudySessionChangedEvent.ChangeType.FINISHED),
                applicationEvents.stream(StudySessionChangedEvent.class)
                        .map(StudySessionChangedEvent::changeType)
                        .toList());
    }

    @Test
    void manualCrossMidnightSessionIsSplitAcrossNaturalDays() throws Exception {
        postJson("/agent/study-sessions/manual", """
                {
                  "content":"完成动态规划练习",
                  "category":"算法",
                  "startedAt":"2026-09-05T15:30:00Z",
                  "endedAt":"2026-09-05T17:30:00Z",
                  "timezone":"Asia/Shanghai",
                  "location":"学校图书馆"
                }
                """);

        mockMvc.perform(get("/agent/study-sessions")
                        .param("from", "2026-09-05")
                        .param("to", "2026-09-05")
                        .param("timezone", "Asia/Shanghai"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].location").value("学校图书馆"));

        mockMvc.perform(get("/agent/study-sessions/statistics")
                        .param("from", "2026-09-05")
                        .param("to", "2026-09-06")
                        .param("timezone", "Asia/Shanghai"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalDurationSeconds").value(7200))
                .andExpect(jsonPath("$.data.days[0].durationSeconds").value(1800))
                .andExpect(jsonPath("$.data.days[1].durationSeconds").value(5400));
    }

    @Test
    void manualSessionsRejectOverlapAndUseVersionForUpdateAndDelete() throws Exception {
        JsonNode created = data(postJson("/agent/study-sessions/manual", """
                {
                  "content":"阅读 JVM 章节",
                  "category":"阅读",
                  "startedAt":"2026-09-04T01:00:00Z",
                  "endedAt":"2026-09-04T02:00:00Z",
                  "timezone":"Asia/Shanghai"
                }
                """));

        mockMvc.perform(post("/agent/study-sessions/manual")
                        .contentType("application/json")
                        .content("""
                                {
                                  "content":"重叠补卡",
                                  "category":"其他",
                                  "startedAt":"2026-09-04T01:30:00Z",
                                  "endedAt":"2026-09-04T02:30:00Z",
                                  "timezone":"Asia/Shanghai"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));

        mockMvc.perform(put("/agent/study-sessions/{id}", created.path("id").asText())
                        .param("expectedVersion", String.valueOf(created.path("version").asInt()))
                        .contentType("application/json")
                        .content("""
                                {
                                  "content":"阅读 JVM 与 GC 章节",
                                  "category":"阅读",
                                  "startedAt":"2026-09-04T01:00:00Z",
                                  "endedAt":"2026-09-04T02:30:00Z",
                                  "timezone":"Asia/Shanghai"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").value("阅读 JVM 与 GC 章节"))
                .andExpect(jsonPath("$.data.version").value(1));

        mockMvc.perform(delete("/agent/study-sessions/{id}", created.path("id").asText())
                        .param("expectedVersion", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(503));

        mockMvc.perform(delete("/agent/study-sessions/{id}", created.path("id").asText())
                        .param("expectedVersion", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    private String postJson(String path, String json) throws Exception {
        return mockMvc.perform(post(path).contentType("application/json").content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andReturn().getResponse().getContentAsString();
    }

    private JsonNode data(String response) throws Exception {
        return objectMapper.readTree(response).path("data");
    }

    private static Path createDatabasePath() {
        try {
            return Files.createTempDirectory("butvan-study-api-test-").resolve("butvan.db");
        } catch (IOException exception) {
            throw new IllegalStateException("无法创建学习记录接口测试数据库目录", exception);
        }
    }

    /** 仅装配学习记录 HTTP 测试所需依赖。 */
    @SpringBootConfiguration
    @EnableAutoConfiguration
    @Import({
            LocalDatabaseConfiguration.class,
            DailyEventRepository.class,
            DailyEventTypeRegistry.class,
            StudyTypeHandler.class,
            StudyRepository.class,
            StudyService.class,
            StudySessionStreamService.class,
            StudyController.class,
            ApiExceptionHandler.class,
            CurrentUserProvider.class
    })
    static class TestApplication {
    }
}
