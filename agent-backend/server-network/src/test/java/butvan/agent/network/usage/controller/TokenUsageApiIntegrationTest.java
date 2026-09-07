package butvan.agent.network.usage.controller;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.agents.session.SessionCatalogService;
import butvan.agent.agents.session.TranscriptService;
import butvan.agent.agents.session.dto.CreateSessionRequest;
import butvan.agent.agents.session.dto.SessionKind;
import butvan.agent.agents.session.dto.TranscriptMessageDto;
import butvan.agent.agents.storage.AgentStorageProperties;
import butvan.agent.agents.usage.ModelIdentity;
import butvan.agent.agents.usage.ModelInputEstimate;
import butvan.agent.agents.usage.ModelInvocationUsage;
import butvan.agent.agents.usage.InputTokenBreakdown;
import butvan.agent.agents.usage.SystemUsageLedger;
import butvan.agent.agents.usage.TurnTokenUsage;
import butvan.agent.agents.usage.ToolTokenUsage;
import butvan.agent.agents.usage.UsagePurpose;
import butvan.agent.agents.usage.UsageStatus;
import butvan.agent.network.config.database.LocalDatabaseConfiguration;
import butvan.agent.network.controller.ApiExceptionHandler;
import butvan.agent.network.usage.repository.TokenUsageRepository;
import butvan.agent.network.usage.service.TokenUsageIndexService;
import butvan.agent.network.usage.service.TokenUsageQueryService;
import io.agentscope.core.model.ChatUsage;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 通过公开 HTTP seam 验证文件源同步与 SQLite Token 聚合。 */
@SpringBootTest(classes = TokenUsageApiIntegrationTest.TestApplication.class)
@AutoConfigureMockMvc
class TokenUsageApiIntegrationTest {

    private static final Path TEST_ROOT = createTestRoot();

    @jakarta.annotation.Resource
    private MockMvc mockMvc;

    @jakarta.annotation.Resource
    private SessionCatalogService sessionCatalogService;

    @jakarta.annotation.Resource
    private TranscriptService transcriptService;

    @jakarta.annotation.Resource
    private SystemUsageLedger systemUsageLedger;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("butvan.database.path", () -> TEST_ROOT.resolve("data/butvan.db").toString());
    }

    @Test
    void overviewCombinesChatAndSystemUsageAndSupportsSessionFilter() throws Exception {
        mockMvc.perform(get("/agent/token-usage/overview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totals.totalTokens").value(0))
                .andExpect(jsonPath("$.data.totals.status").value("UNAVAILABLE"));

        String sessionId = sessionCatalogService.create(
                new CreateSessionRequest(SessionKind.GENERAL, "Token 测试")).id();
        ModelInvocationUsage chatCall = ModelInvocationUsage.fromProvider(
                "chat-call", 1, "main", UsagePurpose.CHAT,
                new ModelIdentity("openai", "gpt-test"),
                ChatUsage.builder().inputTokens(25).outputTokens(7).cachedTokens(5).time(0.4).build(),
                new ModelInputEstimate(
                        "fixture",
                        new InputTokenBreakdown(5, 3, 2, 10, 4, 0, 0),
                        List.of(new ToolTokenUsage("search_web", 10, 4))));
        transcriptService.appendAssistantMessage(
                sessionId, "turn-1", "完成", null,
                TranscriptMessageDto.MessageStatus.COMPLETED, 400L, List.of(),
                new TurnTokenUsage(25, 7, 5, 32, 1, 1, UsageStatus.COMPLETE, List.of(chatCall)));
        systemUsageLedger.append(
                sessionId, UsagePurpose.SESSION_TITLE, "title-call",
                new ModelIdentity("openai", "gpt-test"),
                ChatUsage.builder().inputTokens(4).outputTokens(1).time(0.1).build());

        mockMvc.perform(get("/agent/token-usage/overview").param("sessionId", sessionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totals.totalTokens").value(37))
                .andExpect(jsonPath("$.data.totals.cachedInputTokens").value(5))
                .andExpect(jsonPath("$.data.totals.turnCount").value(1))
                .andExpect(jsonPath("$.data.totals.modelCallCount").value(2))
                .andExpect(jsonPath("$.data.totals.status").value("COMPLETE"))
                .andExpect(jsonPath("$.data.breakdown.systemPromptTokens").value(5))
                .andExpect(jsonPath("$.data.breakdown.toolSchemaTokens").value(10))
                // 会话范围还包含 4 个标题生成输入 Token；该直接 Model 调用没有本地分类，归入 Other。
                .andExpect(jsonPath("$.data.breakdown.otherTokens").value(5))
                .andExpect(jsonPath("$.data.byTool[0].toolName").value("search_web"))
                .andExpect(jsonPath("$.data.byTool[0].schemaTokens").value(10))
                .andExpect(jsonPath("$.data.byTool[0].resultTokens").value(4))
                .andExpect(jsonPath("$.data.byPurpose[0].purpose").exists())
                .andExpect(jsonPath("$.data.byModel[0].model").value("gpt-test"))
                .andExpect(jsonPath("$.data.daily[0].totalTokens").value(37));

        mockMvc.perform(get("/agent/token-usage/overview")
                .param("from", "2026-09-08")
                        .param("to", "2026-09-07"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));
    }

    private static Path createTestRoot() {
        try {
            return Files.createTempDirectory("butvan-token-usage-api-test-");
        } catch (IOException exception) {
            throw new IllegalStateException("无法创建 Token 用量接口测试目录", exception);
        }
    }

    /** 仅装配 Token 用量 HTTP 测试所需依赖，所有文件与数据库均位于临时目录。 */
    @SpringBootConfiguration
    @EnableAutoConfiguration
    @Import({
            LocalDatabaseConfiguration.class,
            TokenUsageRepository.class,
            TokenUsageIndexService.class,
            TokenUsageQueryService.class,
            TokenUsageController.class,
            ApiExceptionHandler.class,
            CurrentUserProvider.class,
            SessionCatalogService.class,
            TranscriptService.class,
            SystemUsageLedger.class
    })
    static class TestApplication {

        @Bean
        AgentStorageProperties agentStorageProperties() {
            return new AgentStorageProperties(TEST_ROOT.resolve("agent-storage"));
        }
    }
}
