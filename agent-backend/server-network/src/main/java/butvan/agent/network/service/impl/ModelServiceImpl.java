package butvan.agent.network.service.impl;

import butvan.agent.agents.model.ModelFactory;
import butvan.agent.network.dto.ModelFetchRequest;
import butvan.agent.network.service.ModelService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
public class ModelServiceImpl implements ModelService {

    @Override
    public List<String> fetchModels(ModelFetchRequest request) {
        if (request == null || request.getVendor() == null || request.getVendor().isBlank()) {
            throw new IllegalArgumentException("Model vendor cannot be empty");
        }
        if (request.getApiKey() == null || request.getApiKey().isBlank()) {
            throw new IllegalArgumentException("API key cannot be empty");
        }

        String vendor = request.getVendor().trim().toLowerCase();
        log.info("Fetching models for vendor: [{}]", vendor);

        // 验证 vendor 是否受 ModelFactory 支持
        ModelFactory.fromVendor(vendor);

        // 根据 vendor 返回模型列表
        return switch (vendor) {
            case "openai" -> List.of("gpt-4o", "gpt-4o-mini", "o3-mini", "gpt-4-turbo");
            case "deepseek" -> List.of("deepseek-chat", "deepseek-reasoner");
            case "dashscope" -> List.of("qwen-max", "qwen-plus", "qwen-turbo", "qwen-long");
            case "gemini" -> List.of("gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash");
            default -> List.of();
        };
    }
}
