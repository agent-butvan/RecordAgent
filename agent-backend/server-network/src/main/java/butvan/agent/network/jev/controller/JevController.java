package butvan.agent.network.jev.controller;

import butvan.agent.agents.config.TypeSafeConfigData;
import butvan.agent.agents.config.TypeSafeProperties;
import butvan.agent.network.annotation.ApiLog;
import butvan.agent.network.common.Result;
import butvan.agent.network.jev.dto.JevDtos.StatusResponse;
import butvan.agent.network.jev.dto.JevDtos.UpdateEnabledRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Jev 路由开关的 HTTP 协议适配层。 */
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/agent/jev")
@RequiredArgsConstructor
public class JevController {

    private final TypeSafeProperties typeSafeProperties;

    /** 查询 Jev 当前开关状态与可用性。 */
    @ApiLog("查询 Jev 开关状态")
    @GetMapping
    public Result<StatusResponse> get() {
        return Result.success(toResponse(typeSafeProperties.load()));
    }

    /** 更新 Jev 总开关；配置不完整时拒绝开启。 */
    @ApiLog("更新 Jev 开关")
    @PutMapping("/enabled")
    public Result<StatusResponse> updateEnabled(@RequestBody UpdateEnabledRequest request) {
        if (request == null) throw new IllegalArgumentException("缺少 Jev 开关状态");
        return Result.success(toResponse(typeSafeProperties.updateEnabled(request.enabled())));
    }

    private static StatusResponse toResponse(TypeSafeConfigData config) {
        return new StatusResponse(config.enabled(), config.isConfigured());
    }
}
