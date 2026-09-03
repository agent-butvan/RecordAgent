package butvan.agent.network.controller;

import butvan.agent.network.annotation.ApiLog;
import butvan.agent.network.common.Result;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 桌面端健康检查 REST 控制器
 * <p>
 * Tauri sidecar 启动后端后，通过该接口探测服务是否就绪。
 */
@Slf4j
@RestController
@RequestMapping("/api/health")
@RequiredArgsConstructor
public class HealthController {

    private final JdbcTemplate jdbcTemplate;

    /**
     * 服务就绪探测接口
     *
     * @return 统一成功响应
     */
    @ApiLog("桌面端后端健康检查")
    @GetMapping
    public Result<String> health() {
        jdbcTemplate.queryForObject("SELECT 1", Integer.class);
        return Result.success("ok");
    }
}
