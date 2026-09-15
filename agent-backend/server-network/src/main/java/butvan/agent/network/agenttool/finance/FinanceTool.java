package butvan.agent.network.agenttool.finance;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.agents.tool.AgentToolModule;
import butvan.agent.agents.tool.result.ToolResult;
import butvan.agent.network.agenttool.common.BusinessToolErrors;
import butvan.agent.network.agenttool.common.BusinessToolExecutor;
import butvan.agent.network.finance.model.FinanceModels.ExpenseChart;
import butvan.agent.network.finance.model.FinanceModels.FinanceAccount;
import butvan.agent.network.finance.model.FinanceModels.FinanceOverview;
import butvan.agent.network.finance.model.FinanceModels.FinanceTransaction;
import butvan.agent.network.finance.service.FinanceService;
import io.agentscope.core.tool.Tool;
import io.agentscope.core.tool.ToolParam;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** 为 Agent 提供资产账户、收支流水与统计查询。 */
@Component
@RequiredArgsConstructor
public class FinanceTool implements AgentToolModule {
    private static final String QUERY = "finance_query";
    private static final String CREATE_ACCOUNT = "finance_create_account";
    private static final String RECORD_TRANSACTION = "finance_record_transaction";
    private static final String TRANSFER = "finance_transfer";
    private static final int MAX_RESULTS = 100;

    private final FinanceService financeService;
    private final CurrentUserProvider currentUserProvider;
    private final BusinessToolExecutor businessToolExecutor;

    @Tool(name = QUERY, description = "查询财务总览、账户、流水、收支图表或分类选项。", readOnly = true)
    public ToolResult<?> query(
            @ToolParam(name = "request", description = "view 以及对应的筛选条件") QueryRequest request) {
        try {
            if (request == null) throw new IllegalArgumentException("查询参数不能为空");
            String ownerId = currentUserProvider.currentUserId();
            String view = required(request.view(), "view");
            return switch (view) {
                case "overview" -> {
                    FinanceOverview overview = financeService.getOverview(ownerId);
                    yield ToolResult.success("已读取财务总览", overview);
                }
                case "accounts" -> {
                    List<FinanceAccount> accounts = financeService.getOverview(ownerId).accounts();
                    yield ToolResult.success("找到 " + accounts.size() + " 个资产账户", accounts);
                }
                case "transactions" -> queryTransactions(ownerId, request);
                case "expense_chart" -> {
                    ExpenseChart chart = financeService.getExpenseChart(ownerId, request.range());
                    yield ToolResult.success("已读取" + chart.range() + "收支趋势", chart);
                }
                case "categories" -> ToolResult.success("已读取收支分类",
                        financeService.getTransactionCategories(ownerId));
                default -> throw new IllegalArgumentException(
                        "view 只能是 overview、accounts、transactions、expense_chart 或 categories");
            };
        } catch (RuntimeException exception) {
            return BusinessToolErrors.from(exception);
        }
    }

    @Tool(name = CREATE_ACCOUNT, description = "创建资产账户，可设置初始余额和年化收益率。")
    public ToolResult<?> createAccount(
            @ToolParam(name = "request", description = "账户信息；写入前会请求用户确认") CreateAccountRequest request) {
        try {
            if (request == null) throw new IllegalArgumentException("账户参数不能为空");
            String ownerId = currentUserProvider.currentUserId();
            return businessToolExecutor.write(ownerId, CREATE_ACCOUNT, request.idempotencyKey(), () -> {
                FinanceAccount account = financeService.createAccount(
                        ownerId, request.name(), request.accountType(), request.currency(),
                        parseMoney(request.initialBalance(), "initialBalance", true), request.interestEnabled(),
                        parseOptionalDecimal(request.annualRatePercent(), "annualRatePercent"));
                return ToolResult.success("已创建资产账户：“" + account.name() + "”", account);
            });
        } catch (RuntimeException exception) {
            return BusinessToolErrors.from(exception);
        }
    }

    @Tool(name = RECORD_TRANSACTION, description = "向指定资产账户记录一笔收入或支出并同步调整余额。金额始终传正数。")
    public ToolResult<?> recordTransaction(
            @ToolParam(name = "request", description = "收入或支出信息；写入前会请求用户确认") TransactionRequest request) {
        try {
            if (request == null) throw new IllegalArgumentException("流水参数不能为空");
            String ownerId = currentUserProvider.currentUserId();
            return businessToolExecutor.write(ownerId, RECORD_TRANSACTION, request.idempotencyKey(), () -> {
                FinanceTransaction transaction = financeService.createTransaction(
                        ownerId, required(request.accountId(), "accountId"), request.transactionType(),
                        request.category(), request.note(), parseMoney(request.amount(), "amount", false),
                        parseDate(request.date()), parseTime(request.time()));
                String action = "expense".equals(transaction.transactionType()) ? "支出" : "收入";
                return ToolResult.success("已记录" + action + " " + transaction.currency() + " " + transaction.amount(),
                        transaction);
            });
        } catch (RuntimeException exception) {
            return BusinessToolErrors.from(exception);
        }
    }

    @Tool(name = TRANSFER, description = "在两个资产账户之间划账并调整双方余额。金额始终传正数。")
    public ToolResult<?> transfer(
            @ToolParam(name = "request", description = "划账信息；写入前会请求用户确认") TransferRequest request) {
        try {
            if (request == null) throw new IllegalArgumentException("划账参数不能为空");
            String ownerId = currentUserProvider.currentUserId();
            return businessToolExecutor.write(ownerId, TRANSFER, request.idempotencyKey(), () -> {
                List<FinanceTransaction> transactions = financeService.transfer(
                        ownerId, required(request.fromAccountId(), "fromAccountId"),
                        required(request.toAccountId(), "toAccountId"),
                        parseMoney(request.amount(), "amount", false),
                        clean(request.note()),
                        parseDate(request.date()), parseTime(request.time()));
                FinanceTransaction fromTx = transactions.get(0);
                return ToolResult.success("已完成划账 " + fromTx.currency() + " " + fromTx.amount() + " 从“"
                        + fromTx.accountName() + "”至“" + transactions.get(1).accountName() + "”", transactions);
            });
        } catch (RuntimeException exception) {
            return BusinessToolErrors.from(exception);
        }
    }

    private ToolResult<?> queryTransactions(String ownerId, QueryRequest request) {
        LocalDate from = parseOptionalDate(request.from(), LocalDate.of(1970, 1, 1), "from");
        LocalDate to = parseOptionalDate(request.to(), LocalDate.of(9999, 12, 31), "to");
        if (from.isAfter(to)) throw new IllegalArgumentException("from 不能晚于 to");
        int limit = request.limit() == null ? 50 : request.limit();
        if (limit < 1 || limit > MAX_RESULTS) throw new IllegalArgumentException("limit 必须在 1 至 100 之间");
        String keyword = clean(request.keyword()).toLowerCase(Locale.ROOT);
        List<FinanceTransaction> transactions = financeService.getTransactions(ownerId).stream()
                .filter(item -> !item.date().isBefore(from) && !item.date().isAfter(to))
                .filter(item -> isBlank(request.accountId()) || item.accountId().equals(request.accountId()))
                .filter(item -> isBlank(request.transactionType()) || item.transactionType().equals(request.transactionType()))
                .filter(item -> isBlank(request.category()) || item.category().equals(request.category()))
                .filter(item -> keyword.isEmpty()
                        || item.note().toLowerCase(Locale.ROOT).contains(keyword)
                        || item.category().toLowerCase(Locale.ROOT).contains(keyword))
                .limit(limit + 1L)
                .toList();
        boolean truncated = transactions.size() > limit;
        List<FinanceTransaction> items = truncated ? transactions.subList(0, limit) : transactions;
        return ToolResult.success("找到 " + items.size() + " 笔流水", new TransactionQueryResult(items, truncated));
    }

    private BigDecimal parseMoney(String value, String field, boolean allowZero) {
        BigDecimal amount = parseDecimal(value == null && allowZero ? "0" : value, field);
        if (allowZero ? amount.signum() < 0 : amount.signum() <= 0) {
            throw new IllegalArgumentException(field + (allowZero ? " 不能小于零" : " 必须大于零"));
        }
        return amount;
    }

    private BigDecimal parseOptionalDecimal(String value, String field) {
        return isBlank(value) ? BigDecimal.ZERO : parseDecimal(value, field);
    }

    private BigDecimal parseDecimal(String value, String field) {
        try {
            return new BigDecimal(required(value, field));
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException(field + " 必须是十进制数字");
        }
    }

    private LocalDate parseDate(String value) {
        return parseOptionalDate(value, LocalDate.now(), "date");
    }

    private LocalTime parseTime(String value) {
        try {
            return isBlank(value) ? LocalTime.now().truncatedTo(ChronoUnit.MINUTES) : LocalTime.parse(value.trim());
        } catch (DateTimeException exception) {
            throw new IllegalArgumentException("time 必须使用 HH:mm 格式");
        }
    }

    private LocalDate parseOptionalDate(String value, LocalDate fallback, String field) {
        try {
            return isBlank(value) ? fallback : LocalDate.parse(value.trim());
        } catch (DateTimeException exception) {
            throw new IllegalArgumentException(field + " 必须使用 YYYY-MM-DD 格式");
        }
    }

    private String required(String value, String field) {
        String cleaned = clean(value);
        if (cleaned.isEmpty()) throw new IllegalArgumentException(field + " 不能为空");
        return cleaned;
    }

    private boolean isBlank(String value) {
        return clean(value).isEmpty();
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }

    public record QueryRequest(
            String view, String range, String from, String to, String accountId,
            String transactionType, String category, String keyword, Integer limit) {
    }

    public record CreateAccountRequest(
            String name, String accountType, String currency, String initialBalance,
            boolean interestEnabled, String annualRatePercent, String idempotencyKey) {
    }

    public record TransactionRequest(
            String accountId, String transactionType, String amount, String category,
            String note, String date, String time, String idempotencyKey) {
    }

    public record TransferRequest(
            String fromAccountId, String toAccountId, String amount, String note,
            String date, String time, String idempotencyKey) {
    }

    public record TransactionQueryResult(List<FinanceTransaction> items, boolean truncated) {
    }
}
