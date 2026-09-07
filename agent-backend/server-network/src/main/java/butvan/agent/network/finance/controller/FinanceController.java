package butvan.agent.network.finance.controller;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.network.annotation.ApiLog;
import butvan.agent.network.common.Result;
import butvan.agent.network.finance.dto.FinanceDtos;
import butvan.agent.network.finance.dto.FinanceDtos.AccountResponse;
import butvan.agent.network.finance.dto.FinanceDtos.CreateAccountRequest;
import butvan.agent.network.finance.dto.FinanceDtos.CreateTransactionRequest;
import butvan.agent.network.finance.dto.FinanceDtos.OverviewResponse;
import butvan.agent.network.finance.dto.FinanceDtos.TransactionResponse;
import butvan.agent.network.finance.service.FinanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 财务模块 HTTP 协议适配层。 */
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/agent/finance")
@RequiredArgsConstructor
public class FinanceController {

    private final FinanceService financeService;
    private final CurrentUserProvider currentUserProvider;

    @ApiLog("查询资产与收支总览")
    @GetMapping("/overview")
    public Result<OverviewResponse> overview() {
        return Result.success(FinanceDtos.from(financeService.getOverview(currentUserProvider.currentUserId())));
    }

    @ApiLog("查询全部财务流水")
    @GetMapping("/transactions")
    public Result<List<TransactionResponse>> transactions() {
        return Result.success(financeService.getTransactions(currentUserProvider.currentUserId()).stream()
                .map(FinanceDtos::from).toList());
    }

    @ApiLog("查询收支分类")
    @GetMapping("/categories")
    public Result<FinanceDtos.TransactionCategoryOptionsResponse> categories() {
        return Result.success(FinanceDtos.categoryOptions(
                financeService.getTransactionCategories(currentUserProvider.currentUserId())));
    }

    @ApiLog("查询收支趋势与支出分类构成")
    @GetMapping("/expense-chart")
    public Result<FinanceDtos.ExpenseChartResponse> expenseChart(
            @RequestParam(defaultValue = "month") String range) {
        return Result.success(FinanceDtos.from(
                financeService.getExpenseChart(currentUserProvider.currentUserId(), range)));
    }

    @ApiLog("创建资产账户")
    @PostMapping("/accounts")
    public Result<AccountResponse> createAccount(@RequestBody CreateAccountRequest request) {
        return Result.success(FinanceDtos.from(financeService.createAccount(
                currentUserProvider.currentUserId(), request.name(), request.accountType(), request.currency(),
                request.initialBalance(), request.interestEnabled(), request.annualRatePercent())));
    }

    @ApiLog("创建收入或支出流水")
    @PostMapping("/transactions")
    public Result<TransactionResponse> createTransaction(@RequestBody CreateTransactionRequest request) {
        return Result.success(FinanceDtos.from(financeService.createTransaction(
                currentUserProvider.currentUserId(), request.accountId(), request.transactionType(),
                request.category(), request.note(), request.amount(), request.date(), request.time())));
    }
}
