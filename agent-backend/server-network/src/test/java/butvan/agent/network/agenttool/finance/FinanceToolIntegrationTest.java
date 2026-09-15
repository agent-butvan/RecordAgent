package butvan.agent.network.agenttool.finance;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.agents.tool.result.ToolResult;
import butvan.agent.network.agenttool.common.BusinessToolExecutor;
import butvan.agent.network.agenttool.finance.FinanceTool.CreateAccountRequest;
import butvan.agent.network.agenttool.finance.FinanceTool.QueryRequest;
import butvan.agent.network.agenttool.finance.FinanceTool.TransactionQueryResult;
import butvan.agent.network.agenttool.finance.FinanceTool.TransactionRequest;
import butvan.agent.network.agenttool.finance.FinanceTool.TransferRequest;
import butvan.agent.network.config.database.LocalDatabaseConfiguration;
import butvan.agent.network.daily.DailyEventModuleConfiguration;
import butvan.agent.network.finance.model.FinanceModels.FinanceAccount;
import butvan.agent.network.finance.repository.FinanceRepository;
import butvan.agent.network.finance.service.FinanceService;
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
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(classes = {
        LocalDatabaseConfiguration.class,
        JacksonAutoConfiguration.class,
        DailyEventModuleConfiguration.class,
        FinanceRepository.class,
        FinanceService.class,
        BusinessToolExecutor.class,
        CurrentUserProvider.class,
        FinanceTool.class
})
class FinanceToolIntegrationTest {
    private static final Path DATABASE_PATH = createDatabasePath();

    @Autowired
    private FinanceTool financeTool;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("butvan.database.path", DATABASE_PATH::toString);
    }

    @Test
    void exposesFinanceToolSchemas() {
        Toolkit toolkit = new Toolkit();
        toolkit.registerTool(financeTool);
        assertEquals(Set.of("finance_query", "finance_create_account", "finance_record_transaction", "finance_transfer"),
                toolkit.getToolNames());
    }

    @Test
    void accountAndTransactionsCanBeCreatedQueriedAndDeduplicated() {
        ToolResult<?> accountResult = financeTool.createAccount(new CreateAccountRequest(
                "测试现金", "other", "CNY", "100.00", false, null, "finance-account-create"));
        FinanceAccount account = assertInstanceOf(FinanceAccount.class, accountResult.data());

        TransactionRequest expense = new TransactionRequest(
                account.id(), "expense", "28.50", "餐饮", "午餐",
                "2026-09-12", "12:00", "finance-expense-create");
        assertTrue(financeTool.recordTransaction(expense).success());
        assertTrue(financeTool.recordTransaction(expense).success());

        ToolResult<?> queryResult = financeTool.query(new QueryRequest(
                "transactions", null, "2026-09-01", "2026-09-30", account.id(),
                "expense", "餐饮", "午餐", 20));
        TransactionQueryResult transactions = assertInstanceOf(TransactionQueryResult.class, queryResult.data());
        assertEquals(1, transactions.items().size());

        ToolResult<?> overdraw = financeTool.recordTransaction(new TransactionRequest(
                account.id(), "expense", "1000.00", "其他", "超额支出",
                "2026-09-12", "13:00", "finance-overdraw"));
        assertFalse(overdraw.success());
        assertEquals("INSUFFICIENT_BALANCE", overdraw.error().code());
    }

    @Test
    void transferAdjustsBothAccountsAndDeduplicates() {
        ToolResult<?> sourceResult = financeTool.createAccount(new CreateAccountRequest(
                "转出银行卡", "bank", "CNY", "500.00", false, null, "finance-transfer-source"));
        FinanceAccount sourceAccount = assertInstanceOf(FinanceAccount.class, sourceResult.data());

        ToolResult<?> targetResult = financeTool.createAccount(new CreateAccountRequest(
                "转入零钱通", "wechat_yield", "CNY", "100.00", false, null, "finance-transfer-target"));
        FinanceAccount targetAccount = assertInstanceOf(FinanceAccount.class, targetResult.data());

        TransferRequest transferRequest = new TransferRequest(
                sourceAccount.id(), targetAccount.id(), "200.00", "转入零钱通理财",
                "2026-09-13", "10:30", "finance-transfer-key-1");

        ToolResult<?> transferResult = financeTool.transfer(transferRequest);
        assertTrue(transferResult.success());
        assertTrue(financeTool.transfer(transferRequest).success());

        ToolResult<?> overdrawTransfer = financeTool.transfer(new TransferRequest(
                sourceAccount.id(), targetAccount.id(), "9999.00", "超额划转",
                "2026-09-13", "10:35", "finance-transfer-overdraw"));
        assertFalse(overdrawTransfer.success());
        assertEquals("INSUFFICIENT_BALANCE", overdrawTransfer.error().code());
    }

    private static Path createDatabasePath() {
        try {
            return Files.createTempDirectory("butvan-finance-tool-test-").resolve("butvan.db");
        } catch (IOException exception) {
            throw new IllegalStateException("无法创建财务工具测试数据库", exception);
        }
    }
}
