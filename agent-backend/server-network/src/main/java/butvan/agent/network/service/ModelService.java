package butvan.agent.network.service;

import butvan.agent.network.dto.ModelFetchRequest;

import java.util.List;

public interface ModelService {

    /**
     * 根据厂商与 API Key 获取/验证可用模型列表
     *
     * @param request 包含 vendor 与 apiKey 的请求参数
     * @return 模型名称列表
     */
    List<String> fetchModels(ModelFetchRequest request);
}
