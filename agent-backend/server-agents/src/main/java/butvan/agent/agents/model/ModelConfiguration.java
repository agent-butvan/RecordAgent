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
     * 初始化 Agent 核心 Model Bean
     *
     * @param localConfigService 本地配置管理服务
     * @param modelHolder        模型持有组件
     * @return Model 实例
     */
    @Bean
    public Model agentModel(LocalConfigService localConfigService,
                           ModelHolder modelHolder) {
        // 从本地 ~/.butvan-agent/config.json 加载配置并更新 ModelHolder
        ModelSelector selector = localConfigService.loadOrInitializeConfig();
        modelHolder.updateModel(selector);

        // 若当前未完成初始化配置，则安全返回 null，后续在控制台提交后由 ModelHolder 统一维护
        if (!modelHolder.isInitialized()) {
            log.info("初始模型配置包含空字段，暂不生成 Agent Model Bean 实例，等待用户完成初始化设置...");
            return null;
        }

        return modelHolder.getModel();
    }
}
