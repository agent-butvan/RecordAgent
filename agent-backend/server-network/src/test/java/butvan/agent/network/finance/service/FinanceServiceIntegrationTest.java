package butvan.agent.network.finance.service;

import butvan.agent.network.config.database.LocalDatabaseConfiguration;
import butvan.agent.network.daily.DailyEventModuleConfiguration;
import butvan.agent.network.daily.model.DailyEventModels.ExpenseCommand;
import butvan.agent.network.daily.model.DailyEventModels.IncomeDetails;
import butvan.agent.network.daily.service.DailyEventService;
import butvan.agent.network.finance.model.FinanceModels.FinanceAccount;
import butvan.agent.network.finance.model.FinanceModels.FinanceOverview;
import butvan.agent.network.finance.model.FinanceModels.ExpenseChart;
import butvan.agent.network.finance.repository.FinanceRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.math.BigDecimal;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** 通过公开领域服务验证账户余额与收支聚合。 */
@SpringBootTest(classes = {
        LocalDatabaseConfiguration.class,
        DailyEventModuleConfiguration.class,
        FinanceRepository.class,
        FinanceService.class
})
class FinanceServiceIntegrationTest {

    private static final Path DATABASE_PATH = createDatabasePath();

    @jakarta.annotation.Resource
    private FinanceService financeService;

    @jakarta.annotation.Resource
    private DailyEventService dailyEventService;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("butvan.database.path", DATABASE_PATH::toString);
    }

    @Test
    void incomeAndExpenseUpdateSelectedAccountAndMonthlyTotals() {
        FinanceAccount account = financeService.createAccount(
                "finance-ledger-user", "微信零钱通", "wechat", "CNY", new BigDecimal("1000.00"),
                true, new BigDecimal("1.850000"));

        financeService.createTransaction("finance-ledger-user", account.id(), "income", "工资", "九月工资",
                new BigDecimal("500.00"), LocalDate.now(), LocalTime.of(9, 0));
        financeService.createTransaction("finance-ledger-user", account.id(), "expense", "餐饮", "午餐",
                new BigDecimal("28.50"), LocalDate.now(), LocalTime.of(12, 0));

        FinanceOverview overview = financeService.getOverview("finance-ledger-user");
        assertEquals(new BigDecimal("1471.50"), overview.totalAssets());
        assertEquals(new BigDecimal("500.00"), overview.monthIncome());
        assertEquals(new BigDecimal("28.50"), overview.monthExpense());
        assertEquals(2, overview.transactions().size());
        assertEquals(2, financeService.getTransactions("finance-ledger-user").size());
    }

    @Test
    void monthlyExpenseIncludesLegacyExpensesRecordedFromCalendar() {
        String ownerId = "finance-calendar-consistency-user";
        LocalDate today = LocalDate.now();
        dailyEventService.create(ownerId,
                new ExpenseCommand(today, "餐饮", "日历中的午餐", new BigDecimal("82.39"), "12:10", "CNY"));

        FinanceOverview overview = financeService.getOverview(ownerId);

        assertEquals(new BigDecimal("82.39"), overview.monthExpense());
    }

    @Test
    void recentTransactionsIncludeLegacyExpensesRecordedFromCalendar() {
        String ownerId = "finance-calendar-recent-user";
        LocalDate today = LocalDate.now();
        dailyEventService.create(ownerId,
                new ExpenseCommand(today, "餐饮", "日历中的晚餐", new BigDecimal("36.80"), "18:30", "CNY"));

        FinanceOverview overview = financeService.getOverview(ownerId);

        assertEquals(1, overview.transactions().size());
        assertEquals("日历中的晚餐", overview.transactions().getFirst().note());
    }

    @Test
    void financeExpensesAppearInCalendarAndChartWithCategoryStacks() {
        String ownerId = "finance-unified-analysis-user";
        LocalDate today = LocalDate.now();
        FinanceAccount account = financeService.createAccount(
                ownerId, "现金", "cash", "CNY", new BigDecimal("500.00"), false, BigDecimal.ZERO);
        financeService.createTransaction(ownerId, account.id(), "expense", "餐饮", "午餐",
                new BigDecimal("30.00"), today, LocalTime.NOON);
        financeService.createTransaction(ownerId, account.id(), "expense", "日常", "纸巾",
                new BigDecimal("12.50"), today, LocalTime.of(13, 0));
        financeService.createTransaction(ownerId, account.id(), "income", "报销", "午餐报销",
                new BigDecimal("80.00"), today, LocalTime.of(14, 0));

        var calendarSummary = dailyEventService.getDays(ownerId, today, today).getFirst();
        ExpenseChart chart = financeService.getExpenseChart(ownerId, "month");
        var chartDay = chart.days().stream().filter(day -> day.date().equals(today)).findFirst().orElseThrow();
        var incomeEvent = dailyEventService.getDay(ownerId, today).events().stream()
                .filter(event -> "income".equals(event.eventType())).findFirst().orElseThrow();

        assertEquals(new BigDecimal("42.50"), calendarSummary.expenseTotal());
        assertEquals(2, calendarSummary.eventCount());
        assertEquals(new BigDecimal("42.50"), chartDay.total());
        assertEquals(new BigDecimal("80.00"), chartDay.income());
        assertEquals(new BigDecimal("80.00"), chart.totalIncome());
        assertEquals(new BigDecimal("80.00"), assertInstanceOf(IncomeDetails.class, incomeEvent.details()).amount());
        assertEquals(2, chartDay.categories().size());
    }

    @Test
    void expenseCannotOverdrawAccount() {
        FinanceAccount account = financeService.createAccount(
                "finance-overdraft-user", "现金", "cash", "CNY", new BigDecimal("20.00"), false, BigDecimal.ZERO);

        assertThrows(IllegalArgumentException.class, () -> financeService.createTransaction(
                "finance-overdraft-user", account.id(), "expense", "其他", "超额支出",
                new BigDecimal("20.01"), LocalDate.now(), LocalTime.NOON));
        assertEquals(new BigDecimal("20.00"), financeService.getOverview("finance-overdraft-user").totalAssets());
    }

    @Test
    void supportedAccountCategoriesCanBeCreated() {
        List<String> accountTypes = List.of(
                "wechat_balance", "wechat_yield", "alipay_balance", "alipay_yuebao", "bank", "other");

        for (String accountType : accountTypes) {
            FinanceAccount account = financeService.createAccount(
                    "finance-account-types-user", accountType, accountType, "CNY",
                    BigDecimal.ZERO, false, BigDecimal.ZERO);
            assertEquals(accountType, account.accountType());
        }
    }

    @Test
    void interestAccountCreatesOneAutomaticIncomePerDay() {
        FinanceAccount account = financeService.createAccount(
                "finance-yield-user", "余额宝", "alipay", "CNY", new BigDecimal("36500.00"),
                true, new BigDecimal("1.000000"));

        financeService.settleYieldThrough("finance-yield-user", LocalDate.now().plusDays(1));
        FinanceOverview overview = financeService.getOverview("finance-yield-user");

        assertEquals(new BigDecimal("36501.00"), overview.totalAssets());
        assertEquals(1, overview.transactions().size());
        assertEquals("yield", overview.transactions().getFirst().transactionType());
        assertEquals("automatic", overview.transactions().getFirst().source());
        assertEquals(new BigDecimal("1.00"), overview.transactions().getFirst().amount());
    }

    private static Path createDatabasePath() {
        try {
            return Files.createTempDirectory("butvan-finance-test-").resolve("butvan.db");
        } catch (IOException exception) {
            throw new IllegalStateException("无法创建财务测试数据库", exception);
        }
    }
}
