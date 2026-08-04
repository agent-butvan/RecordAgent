package butvan.agent.network.controller;

import butvan.agent.agents.model.ModelSelector;
import butvan.agent.network.annotation.ApiLog;
import butvan.agent.network.common.Result;
import butvan.agent.network.dto.SetModel;
import butvan.agent.network.service.ModelService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 模型配置 REST 控制器
 */
@Slf4j
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/agent/model")
@RequiredArgsConstructor
public class ModelController {

    private final ModelService modelService;

    /**
     * 更新保存模型配置
     *
     * @param model 模型配置参数
     * @return 状态响应
     */
    @ApiLog("更新与保存模型配置")
    @PostMapping
    public Result<String> updateModelConfig(@RequestBody SetModel model) {
        modelService.updateModelConfig(model);
        return Result.success("更新模型配置成功！");
    }

    /**
     * 查询当前运行及本地保存的模型配置信息
     *
     * @return 当前 ModelSelector 配置
     */
    @ApiLog("查询当前本地模型配置")
    @GetMapping("/config")
    public Result<ModelSelector> getModelConfig() {
        ModelSelector selector = modelService.getModelConfig();
        return Result.success(selector);
    }

    /**
     * 获取系统支持的模型供应商列表（从 application-vendor.yml 中配置导出）
     *
     * @return 支持的 vendor 列表
     */
    @ApiLog("获取系统支持的模型供应商列表")
    @GetMapping("/vendors")
    public Result<List<String>> getSupportedVendors() {
        List<String> vendors = modelService.getSupportedVendors();
        return Result.success(vendors);
    }
}