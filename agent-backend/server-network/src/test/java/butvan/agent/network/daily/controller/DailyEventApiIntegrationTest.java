package butvan.agent.network.daily.controller;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.network.config.database.LocalDatabaseConfiguration;
import butvan.agent.network.controller.ApiExceptionHandler;
import butvan.agent.network.daily.DailyEventModuleConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 通过 HTTP seam 验证日记录请求和统一响应。 */
@SpringBootTest(classes = DailyEventApiIntegrationTest.TestApplication.class)
@AutoConfigureMockMvc
class DailyEventApiIntegrationTest {

    private static final Path DATABASE_PATH = createDatabasePath();

    @jakarta.annotation.Resource
    private MockMvc mockMvc;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("butvan.database.path", DATABASE_PATH::toString);
    }

    @Test
    void apiCreatesTodoAndReturnsItInDayTimeline() throws Exception {
        mockMvc.perform(post("/agent/daily-events/todos")
                        .contentType("application/json")
                        .content("""
                                {
                                  "eventDate": "2026-09-06",
                                  "title": "验证日记录接口",
                                  "time": "08:00",
                                  "priority": "low",
                                  "recurrence": "weekly",
                                  "recurrenceWeekday": 7
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.eventType").value("todo"))
                .andExpect(jsonPath("$.data.details.recurrence").value("weekly"))
                .andExpect(jsonPath("$.data.details.recurrenceWeekday").value(7))
                .andExpect(jsonPath("$.data.details.recurrenceMonthDay").doesNotExist());

        mockMvc.perform(get("/agent/daily-events/days/2026-09-06"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.events[0].title").value("验证日记录接口"))
                .andExpect(jsonPath("$.data.events[0].details.completed").value(false));

        mockMvc.perform(get("/agent/daily-events/recurring-todos?date=2026-09-03"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].title").value("验证日记录接口"))
                .andExpect(jsonPath("$.data[0].recurrence").value("weekly"))
                .andExpect(jsonPath("$.data[0].occurrenceDate").value("2026-09-06"))
                .andExpect(jsonPath("$.data[0].completed").value(false));
    }

    @Test
    void apiAcceptsScheduleWithoutTimes() throws Exception {
        mockMvc.perform(post("/agent/daily-events/schedules")
                        .contentType("application/json")
                        .content("""
                                {
                                  "eventDate": "2026-09-08",
                                  "title": "时间待定的会面",
                                  "location": "线上",
                                  "timezone": "Asia/Shanghai"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.details.startTime").doesNotExist())
                .andExpect(jsonPath("$.data.details.endTime").doesNotExist());
    }

    private static Path createDatabasePath() {
        try {
            return Files.createTempDirectory("butvan-daily-api-test-").resolve("butvan.db");
        } catch (IOException exception) {
            throw new IllegalStateException("无法创建日记录接口测试数据库目录", exception);
        }
    }

    /** 仅装配日记录 HTTP 测试所需依赖。 */
    @SpringBootConfiguration
    @EnableAutoConfiguration
    @Import({
            LocalDatabaseConfiguration.class,
            DailyEventModuleConfiguration.class,
            DailyEventController.class,
            ApiExceptionHandler.class,
            CurrentUserProvider.class
    })
    static class TestApplication {
    }
}
