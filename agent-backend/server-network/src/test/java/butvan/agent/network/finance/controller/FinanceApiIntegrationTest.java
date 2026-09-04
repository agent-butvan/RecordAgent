package butvan.agent.network.finance.controller;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.network.config.database.LocalDatabaseConfiguration;
import butvan.agent.network.controller.ApiExceptionHandler;
import butvan.agent.network.finance.repository.FinanceRepository;
import butvan.agent.network.finance.service.FinanceService;
import butvan.agent.network.daily.service.ExpenseAnalyticsService;
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

/** 通过 HTTP seam 验证财务账户与流水接口。 */
@SpringBootTest(classes = FinanceApiIntegrationTest.TestApplication.class)
@AutoConfigureMockMvc
class FinanceApiIntegrationTest {

    private static final Path DATABASE_PATH = createDatabasePath();

    @jakarta.annotation.Resource
    private MockMvc mockMvc;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("butvan.database.path", DATABASE_PATH::toString);
    }

    @Test
    void apiCreatesAccountAndIncomeTransaction() throws Exception {
        String accountJson = mockMvc.perform(post("/agent/finance/accounts")
                        .contentType("application/json")
                        .content("""
                                {
                                  "name": "支付宝余额宝",
                                  "accountType": "alipay",
                                  "currency": "CNY",
                                  "initialBalance": 1000.00,
                                  "interestEnabled": true,
                                  "annualRatePercent": 1.85
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("支付宝余额宝"))
                .andReturn().getResponse().getContentAsString();
        String accountId = new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree(accountJson).path("data").path("id").asText();

        mockMvc.perform(post("/agent/finance/transactions")
                        .contentType("application/json")
                        .content("""
                                {
                                  "accountId": "%s",
                                  "transactionType": "income",
                                  "category": "工资",
                                  "note": "九月工资",
                                  "amount": 500.00,
                                  "date": "2026-09-03",
                                  "time": "09:00"
                                }
                                """.formatted(accountId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.transactionType").value("income"));

        mockMvc.perform(get("/agent/finance/overview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalAssets").value(1500.00))
                .andExpect(jsonPath("$.data.accounts[0].name").value("支付宝余额宝"));

        mockMvc.perform(get("/agent/finance/transactions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].note").value("九月工资"))
                .andExpect(jsonPath("$.data[0].accountName").value("支付宝余额宝"));

        mockMvc.perform(get("/agent/finance/expense-chart").param("range", "month"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.range").value("month"))
                .andExpect(jsonPath("$.data.totalIncome").value(500.00))
                .andExpect(jsonPath("$.data.days").isArray());
    }

    private static Path createDatabasePath() {
        try {
            return Files.createTempDirectory("butvan-finance-api-test-").resolve("butvan.db");
        } catch (IOException exception) {
            throw new IllegalStateException("无法创建财务接口测试数据库目录", exception);
        }
    }

    /** 仅装配财务 HTTP 测试所需依赖。 */
    @SpringBootConfiguration
    @EnableAutoConfiguration
    @Import({
            LocalDatabaseConfiguration.class,
            FinanceRepository.class,
            ExpenseAnalyticsService.class,
            FinanceService.class,
            FinanceController.class,
            ApiExceptionHandler.class,
            CurrentUserProvider.class
    })
    static class TestApplication {
    }
}
