package butvan.agent.agents.model;

import butvan.agent.agents.model.config.ModelProviderProperties;
import butvan.agent.agents.model.dto.ModelSelector;
import butvan.agent.agents.model.registry.AgentScopeModelRegistry;
import io.agentscope.core.model.Model;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("agent")
@TestPropertySource(locations = "classpath:application-agent.yml")
@EnableConfigurationProperties(ModelProviderProperties.class)
@SpringBootTest(classes = {
        ModelProviderProperties.class,
        AgentScopeModelRegistry.class
})
public class AgentScopeModelRegistryTest {

    @Autowired
    private AgentScopeModelRegistry modelRegistry;

    @Test
    @DisplayName("测试获取默认配置模型")
    public void testGetDefaultModel() {
        Model defaultModel = modelRegistry.getDefaultModel();
        assertNotNull(defaultModel, "系统默认 AgentScope Model 实例不应为空");
    }

    @Test
    @DisplayName("测试根据 ModelSelector 动态路由模型与缓存复用")
    public void testDynamicModelRoutingAndCaching() {
        // 1. 获取 DashScope 模型
        ModelSelector dashscopeSelector = ModelSelector.of("dashscope", "qwen-max");
        Model model1 = modelRegistry.getModel(dashscopeSelector);
        assertNotNull(model1, "DashScope Model 实例构建不应为空");

        // 2. 再次获取相同的厂商与模型，验证缓存机制
        Model model2 = modelRegistry.getModel(dashscopeSelector);
        assertSame(model1, model2, "相同厂商与模型名再次请求时，应直接使用缓存实例");
    }

    @Test
    @DisplayName("测试 OpenAI/Compat 协议动态模型构建")
    public void testOpenAiCompatModelCreation() {
        ModelSelector deepseekSelector = ModelSelector.of("deepseek", "deepseek-reasoner");
        Model deepseekModel = modelRegistry.getModel(deepseekSelector);
        assertNotNull(deepseekModel, "DeepSeek Model 实例构建不应为空");
    }
}
