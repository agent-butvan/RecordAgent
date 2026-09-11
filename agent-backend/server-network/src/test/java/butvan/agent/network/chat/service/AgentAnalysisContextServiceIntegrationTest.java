package butvan.agent.network.chat.service;

import butvan.agent.network.chat.dto.AgentAnalysisContextRequest;
import butvan.agent.network.chat.dto.AgentChatRequest;
import butvan.agent.network.config.database.LocalDatabaseConfiguration;
import butvan.agent.network.daily.DailyEventModuleConfiguration;
import butvan.agent.network.daily.model.DailyEventModels.TodoCommand;
import butvan.agent.network.daily.service.DailyEventService;
import butvan.agent.network.finance.repository.FinanceRepository;
import butvan.agent.network.finance.service.FinanceService;
import butvan.agent.network.insight.service.DailyInsightService;
import butvan.agent.network.record.model.RecordModels.RecordCommand;
import butvan.agent.network.record.model.RecordModels.RecordType;
import butvan.agent.network.record.service.RecordService;
import butvan.agent.network.study.repository.StudyRepository;
import butvan.agent.network.study.service.StudyService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 通过真实临时数据库验证分析命令只读取当前用户的受控业务投影。 */
@SpringBootTest(classes = AgentAnalysisContextServiceIntegrationTest.TestApplication.class)
class AgentAnalysisContextServiceIntegrationTest {
    private static final Path DATABASE_PATH = createDatabasePath();
    private static final String OWNER = "analysis-owner";
    private static final ZoneId TIMEZONE = ZoneId.of("Asia/Shanghai");

    @jakarta.annotation.Resource private AgentAnalysisContextService service;
    @jakarta.annotation.Resource private DailyEventService dailyEventService;
    @jakarta.annotation.Resource private RecordService recordService;
    @jakarta.annotation.Resource private FinanceService financeService;
    @jakarta.annotation.Resource private StudyService studyService;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("butvan.database.path", DATABASE_PATH::toString);
    }

    @Test
    void buildsDailyReviewFromFourDomainServicesAfterExplicitConsent() {
        LocalDate date = LocalDate.now(TIMEZONE).minusDays(1);
        dailyEventService.create(OWNER, new TodoCommand(date, "完成复盘", "09:00", "high", "none"));
        recordService.create(OWNER, new RecordCommand(date, RecordType.LEARNING, "学习资料",
                "<p>领域服务</p>", "领域服务", List.of("架构"), null));
        var account = financeService.createAccount(OWNER, "现金", "cash", "CNY",
                new BigDecimal("100.00"), false, BigDecimal.ZERO);
        financeService.createTransaction(OWNER, account.id(), "expense", "餐饮", "午餐",
                new BigDecimal("12.34"), date, LocalTime.NOON);
        Instant start = date.atTime(10, 0).atZone(TIMEZONE).toInstant();
        studyService.createManual(OWNER, "阅读架构资料", "阅读", start, start.plusSeconds(3600), TIMEZONE, null);

        AgentAnalysisContextRequest analysis = new AgentAnalysisContextRequest(
                "daily-review", date.toString(), TIMEZONE.getId(), true);
        var call = service.prepare(OWNER, new AgentChatRequest(
                "session", "/daily-review", "", List.of(), analysis));

        assertEquals("/daily-review", call.content());
        assertEquals(1, call.ragContexts().size());
        assertTrue(call.context().contains("完成复盘"));
        assertTrue(call.context().contains("资料：1"));
        assertTrue(call.context().contains("支出：12.34"));
        assertTrue(call.context().contains("学习秒数：3600"));
    }

    private static Path createDatabasePath() {
        try {
            return Files.createTempDirectory("butvan-analysis-context-test-").resolve("butvan.db");
        } catch (IOException exception) {
            throw new IllegalStateException("无法创建分析上下文测试数据库目录", exception);
        }
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @Import({
            LocalDatabaseConfiguration.class,
            DailyEventModuleConfiguration.class,
            RecordService.class,
            FinanceRepository.class,
            FinanceService.class,
            StudyRepository.class,
            StudyService.class,
            DailyInsightService.class,
            AgentAnalysisContextService.class
    })
    static class TestApplication {
    }
}
