package butvan.agent.network.dailycontext.controller;

import butvan.agent.network.annotation.ApiLog;
import butvan.agent.network.common.Result;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.ConfigResponse;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.LocationResponse;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.SummaryResponse;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.UpdateConfigRequest;
import butvan.agent.network.dailycontext.service.DailyContextConfigService;
import butvan.agent.network.dailycontext.service.DailyContextService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/** 天气、节假日配置与摘要的 HTTP 协议适配层。 */
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/agent/daily-context")
@RequiredArgsConstructor
public class DailyContextController {
    private final DailyContextConfigService configService;
    private final DailyContextService dailyContextService;

    @ApiLog("查询天气与节假日脱敏配置")
    @GetMapping("/config")
    public Result<ConfigResponse> config() {
        return Result.success(configService.getPublicConfig());
    }

    @ApiLog("保存天气与节假日配置")
    @PutMapping("/config")
    public Result<ConfigResponse> updateConfig(@RequestBody UpdateConfigRequest request) {
        ConfigResponse response = configService.update(request);
        dailyContextService.clearCaches();
        return Result.success(response);
    }

    @ApiLog("查询天气与节假日摘要")
    @GetMapping("/summary")
    public Result<SummaryResponse> summary(
            @RequestParam LocalDate date,
            @RequestParam(defaultValue = "true") boolean weather,
            @RequestParam(defaultValue = "true") boolean holiday) {
        return Result.success(dailyContextService.getSummary(date, weather, holiday));
    }

    @ApiLog("根据设备坐标识别天气地点")
    @GetMapping("/location")
    public Result<LocationResponse> location(
            @RequestParam double latitude,
            @RequestParam double longitude) {
        return Result.success(dailyContextService.resolveLocation(latitude, longitude));
    }
}
