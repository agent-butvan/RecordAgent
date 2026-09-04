package butvan.agent.network.record.controller;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.network.config.database.LocalDatabaseConfiguration;
import butvan.agent.network.controller.ApiExceptionHandler;
import butvan.agent.network.record.repository.RecordRepository;
import butvan.agent.network.record.service.RecordService;
import butvan.agent.network.record.service.RecordAttachmentService;
import butvan.agent.network.record.service.RecordBackupService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 通过公开 HTTP seam 验证记录创建、检索、周复盘和回收站行为。 */
@SpringBootTest(classes = RecordApiIntegrationTest.TestApplication.class)
@AutoConfigureMockMvc
class RecordApiIntegrationTest {
    private static final Path DATABASE_PATH = createDatabasePath();
    @jakarta.annotation.Resource private MockMvc mockMvc;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) { registry.add("butvan.database.path", DATABASE_PATH::toString); }

    @Test
    void createsSearchesAndTrashesWeeklyReview() throws Exception {
        String response = mockMvc.perform(post("/agent/records").contentType("application/json").content("""
                {"recordDate":"2026-09-04","type":"weekly_review","title":"第 36 周复盘",
                 "contentHtml":"<p>完成记录模块设计</p>","contentText":"完成记录模块设计","tags":["产品","复盘"]}
                """)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.weekYear").value(2026))
                .andExpect(jsonPath("$.data.weekNumber").value(36))
                .andExpect(jsonPath("$.data.tags[0]").value("产品"))
                .andReturn().getResponse().getContentAsString();
        var node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(response).path("data");
        String recordId = node.path("id").asText();

        mockMvc.perform(multipart("/agent/records/" + recordId + "/attachments")
                        .file(new MockMultipartFile("file", "notes.txt", "text/plain", "附件内容".getBytes())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.originalName").value("notes.txt"));

        mockMvc.perform(get("/agent/records").param("from", "2026-09-01").param("to", "2026-09-30")
                        .param("query", "记录模块"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(1));
        mockMvc.perform(get("/agent/records/days").param("from", "2026-09-01").param("to", "2026-09-30"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].weeklyReviewCompleted").value(true));
        mockMvc.perform(delete("/agent/records/" + recordId)
                        .param("expectedVersion", node.path("version").asText()))
                .andExpect(status().isOk());
        mockMvc.perform(get("/agent/records/trash"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(1));

        byte[] backup = mockMvc.perform(get("/agent/records/backup"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        mockMvc.perform(multipart("/agent/records/backup")
                        .file(new MockMultipartFile("file", "backup.zip", "application/zip", backup)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data").value(1));
        mockMvc.perform(get("/agent/records/trash"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].type").value("weekly_review"));
    }

    private static Path createDatabasePath() {
        try { return Files.createTempDirectory("butvan-record-api-test-").resolve("butvan.db"); }
        catch (IOException exception) { throw new IllegalStateException("无法创建记录接口测试数据库目录", exception); }
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @Import({LocalDatabaseConfiguration.class, RecordRepository.class, RecordService.class,
            RecordAttachmentService.class, RecordBackupService.class,
            RecordController.class, ApiExceptionHandler.class, CurrentUserProvider.class})
    static class TestApplication { }
}
