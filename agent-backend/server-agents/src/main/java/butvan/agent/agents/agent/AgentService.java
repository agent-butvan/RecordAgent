package butvan.agent.agents.agent;

import butvan.agent.agents.model.ModelHolder;
import io.agentscope.core.ReActAgent;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.MsgRole;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Agent 核心服务类
 * 负责组装并运行 AgentScope ReActAgent
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AgentService {

    /**
     * 模型持有者组件，动态提供当前激活的 Model 实例
     */
    private final ModelHolder modelHolder;

    /**
     * 运行 ReActAgent 示例方法
     */
    public void runAgent() {
        if (!modelHolder.isInitialized()) {
            log.info("当前模型尚未完成初始化配置，跳过自动运行示例 Agent");
            return;
        }

        // 从 ModelHolder 中动态获取最新的 Model 实例构建 Agent
        ReActAgent agent = ReActAgent.builder().model(modelHolder.getModel()).build();

        // 构造用户消息并调用 Agent
        Msg msg = agent.call(
                Msg.builder()
                        .role(MsgRole.USER)
                        .textContent("你好，你是什么模型？")
                        .build())
                .block();

        log.info("Agent 响应内容: [{}]", msg != null ? msg.getTextContent() : "");
    }
}
