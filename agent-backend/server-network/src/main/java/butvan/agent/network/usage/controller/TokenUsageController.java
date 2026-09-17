package butvan.agent.network.usage.controller;

import butvan.agent.network.annotation.ApiLog;
import butvan.agent.network.common.Result;
import butvan.agent.network.usage.dto.TokenUsageResponses.OverviewResponse;
import butvan.agent.network.usage.service.TokenUsageQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/** Token 用量统计 HTTP 协议适配层。 */
@RestController
@RequestMapping("/agent/token-usage")
@RequiredArgsConstructor
public class TokenUsageController {

    /** Token 用量统计服务。 */
    private final TokenUsageQueryService queryService;

    /** 查询全局或单会话的 Token 用量总览。 */
    @ApiLog("查询 Token 用量总览")
    @GetMapping("/overview")
    public Result<OverviewResponse> overview(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String sessionId
    ) {
        return Result.success(queryService.overview(from, to, sessionId));
    }
}
