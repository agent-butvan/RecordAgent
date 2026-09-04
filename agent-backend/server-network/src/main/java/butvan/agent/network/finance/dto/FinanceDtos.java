package butvan.agent.network.finance.dto;

import butvan.agent.network.finance.model.FinanceModels.FinanceAccount;
import butvan.agent.network.finance.model.FinanceModels.FinanceOverview;
import butvan.agent.network.finance.model.FinanceModels.FinanceTransaction;
import butvan.agent.network.finance.model.FinanceModels.ExpenseChart;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/** 财务接口请求、响应与领域映射。 */
public final class FinanceDtos {

    private FinanceDtos() {
    }

    public record CreateAccountRequest(
            String name, String accountType, String currency, BigDecimal initialBalance,
            boolean interestEnabled, BigDecimal annualRatePercent) {
    }

    public record CreateTransactionRequest(
            String accountId, String transactionType, String category, String note,
            BigDecimal amount, LocalDate date, LocalTime time) {
    }

    public record AccountResponse(
            String id, String name, String accountType, String currency, BigDecimal balance,
            boolean interestEnabled, BigDecimal annualRatePercent, LocalDate lastAccrualDate, int version) {
    }

    public record TransactionResponse(
            String id, String accountId, String accountName, LocalDate date, LocalTime time,
            String transactionType, String category, String note, BigDecimal amount,
            String currency, String source, Instant createdAt) {
    }

    public record OverviewResponse(
            BigDecimal totalAssets, BigDecimal monthIncome, BigDecimal monthExpense, BigDecimal monthYield,
            List<AccountResponse> accounts, List<TransactionResponse> transactions) {
    }

    public record ExpenseCategoryResponse(String category, BigDecimal amount) {
    }

    public record ExpenseChartDayResponse(
            LocalDate date, BigDecimal total, BigDecimal income, List<ExpenseCategoryResponse> categories) {
    }

    public record ExpenseChartResponse(
            String range, LocalDate from, LocalDate to, BigDecimal totalExpense, BigDecimal totalIncome,
            List<ExpenseChartDayResponse> days) {
    }

    public static AccountResponse from(FinanceAccount account) {
        return new AccountResponse(account.id(), account.name(), account.accountType(), account.currency(),
                account.balance(), account.interestEnabled(), account.annualRatePercent(),
                account.lastAccrualDate(), account.version());
    }

    public static TransactionResponse from(FinanceTransaction transaction) {
        return new TransactionResponse(transaction.id(), transaction.accountId(), transaction.accountName(),
                transaction.date(), transaction.time(), transaction.transactionType(), transaction.category(),
                transaction.note(), transaction.amount(), transaction.currency(), transaction.source(),
                transaction.createdAt());
    }

    public static OverviewResponse from(FinanceOverview overview) {
        return new OverviewResponse(overview.totalAssets(), overview.monthIncome(), overview.monthExpense(),
                overview.monthYield(), overview.accounts().stream().map(FinanceDtos::from).toList(),
                overview.transactions().stream().map(FinanceDtos::from).toList());
    }

    public static ExpenseChartResponse from(ExpenseChart chart) {
        return new ExpenseChartResponse(chart.range(), chart.from(), chart.to(), chart.totalExpense(), chart.totalIncome(),
                chart.days().stream().map(day -> new ExpenseChartDayResponse(
                        day.date(), day.total(), day.income(), day.categories().stream()
                        .map(item -> new ExpenseCategoryResponse(item.category(), item.amount())).toList())).toList());
    }
}
