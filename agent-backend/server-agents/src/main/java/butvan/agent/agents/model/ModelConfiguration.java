package butvan.agent.agents.model;

import butvan.agent.agents.config.LocalConfigService;
import io.agentscope.core.model.Model;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 模型 Spring 配置类
 * 启动时由 LocalConfigService 加载本地配置并初始化 ModelHolder 容器
 */
@Slf4j
@Configuration
public class ModelConfiguration {

    /**
     * 初始化 Agent 核心 Model 代理 Bean
     * 允许在未完成模型配置时后端仍能安全启动服务，并在用户在界面配置后动态转发调用
     *
     * @param localConfigService 本地配置管理服务
     * @param modelHolder        模型持有组件
     * @return Model 代理实例
     */
    @Bean
    public Model agentModel(LocalConfigService localConfigService,
                           ModelHolder modelHolder) {
        // 从本地 ~/.butvan-agent/config.json 加载配置并更新 ModelHolder
        ModelSelector selector = localConfigService.loadOrInitializeConfig();
        modelHolder.updateModel(selector);

        // 返回动态代理转发对象
        return (request, options) -> modelHolder.getModel().call(request, options);
    }
}
