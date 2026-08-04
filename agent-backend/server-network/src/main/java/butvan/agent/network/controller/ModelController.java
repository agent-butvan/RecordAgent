package butvan.agent.network.controller;

import butvan.agent.network.common.Result;
import butvan.agent.network.dto.ModelFetchRequest;
import butvan.agent.network.service.ModelService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/agent/model")
@RequiredArgsConstructor
public class ModelController {

    private final ModelService modelService;

    /**
     * 前端传递 vendor 和 apiKey 获取模型列表
     *
     * @param request 包含 vendor 和 apiKey 的请求体
     * @return 模型名称列表响应结果
     */
    @PostMapping("/fetch")
    public Result<List<String>> fetchModels(@RequestBody ModelFetchRequest request) {
        List<String> models = modelService.fetchModels(request);
        return Result.success(models);
    }
}