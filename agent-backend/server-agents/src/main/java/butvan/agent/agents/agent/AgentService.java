package butvan.agent.agents.agent;

import butvan.agent.agents.model.ModelHolder;
import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.message.UserMessage;
import io.agentscope.core.model.Model;
import io.agentscope.harness.agent.HarnessAgent;
import io.agentscope.harness.agent.memory.compaction.CompactionConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.nio.file.Paths;

/**
 * Agent 核心服务类
 * 负责组装 HarnessAgent 并实现基于 SSE 的响应事件流输出
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
     * 运行 HarnessAgent 并推送 SSE 流式事件
     *
     * @param agentUserCall 用户发起的对话调用对象
     * @return SseEmitter SSE 响应流对象
     */
    public SseEmitter streamAgent(AgentUserCall agentUserCall) {
        SseEmitter emitter = new SseEmitter(0L); // 设置为永超时

        if (!modelHolder.isInitialized()) {
            log.warn("当前模型尚未完成初始化配置，无法启动 Agent 对话");
            try {
                emitter.send(SseEmitter.event().data("错误：模型尚未完成初始化配置，请先在界面设置 API 密钥。"));
                emitter.complete();
            } catch (IOException e) {
                emitter.completeWithError(e);
            }
            return emitter;
        }

        Model model = modelHolder.getModel();

        HarnessAgent harnessAgent = HarnessAgent.builder()
                .name("butvan-agent")
                .sysPrompt("你是一个全能智能助手，请简洁、清晰地解答用户的各种技术与日常问题。")
                .model(model)
                .workspace(Paths.get(".agentscope/workspace"))
                .compaction(CompactionConfig.builder()
                        .triggerMessages(30)
                        .keepMessages(10)
                        .build())
                .build();

        RuntimeContext ctx = RuntimeContext.builder()
                .sessionId(agentUserCall != null && agentUserCall.sessionId() != null ? agentUserCall.sessionId() : "default_session")
                .userId("butvan")
                .build();

        String contextText = agentUserCall != null && agentUserCall.context() != null ? agentUserCall.context() : "";

        harnessAgent.streamEvents(new UserMessage(contextText), ctx)
                .subscribe(
                        event -> {
                            try {
                                if (event != null) {
                                    String text = null;
                                    if (event.getMsg() != null && event.getMsg().getTextContent() != null) {
                                        text = event.getMsg().getTextContent();
                                    } else {
                                        text = event.toString();
                                    }
                                    if (text != null && !text.isEmpty()) {
                                        emitter.send(SseEmitter.event().data(text));
                                    }
                                }
                            } catch (IOException e) {
                                log.error("推送 SSE 消息增量块失败", e);
                                emitter.completeWithError(e);
                            }
                        },
                        error -> {
                            log.error("HarnessAgent 事件流处理过程异常", error);
                            try {
                                emitter.send(SseEmitter.event().data("处理异常: " + error.getMessage()));
                            } catch (IOException ignored) {
                            }
                            emitter.completeWithError(error);
                        },
                        () -> {
                            log.info("HarnessAgent 事件流成功完成");
                            emitter.complete();
                        }
                );

        return emitter;
    }
}
