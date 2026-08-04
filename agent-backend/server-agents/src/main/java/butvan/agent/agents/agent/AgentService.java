package butvan.agent.agents.agent;

import butvan.agent.agents.model.ModelHolder;
import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.message.UserMessage;
import io.agentscope.core.model.Model;
import io.agentscope.harness.agent.HarnessAgent;
import io.agentscope.harness.agent.memory.compaction.CompactionConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.nio.file.Paths;

/**
 * Agent 核心服务类
 * 参考 mewcode-java 项目与 AgentScope 官网规范实现 Agent 的 SSE 流式响应
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentService {

    /**
     * 模型持有者组件，动态提供当前激活的 Model 实例
     */
    private final ModelHolder modelHolder;

    /**
     * 运行 HarnessAgent 并通过 SseEmitter 推送流式响应
     *
     * @param agentUserCall 用户发起的对话请求
     * @return SseEmitter
     */
    public SseEmitter streamAgent(AgentUserCall agentUserCall) {
        SseEmitter emitter = new SseEmitter(0L); // 永超时

        if (!modelHolder.isInitialized()) {
            log.warn("当前模型尚未完成初始化配置，无法启动 Agent 对话");
            try {
                emitter.send(SseEmitter.event().name("error").data("当前模型尚未完成初始化配置，请先在界面设置 API 密钥。"));
                emitter.complete();
            } catch (IOException e) {
                emitter.completeWithError(e);
            }
            return emitter;
        }

        Model model = modelHolder.getModel();

        // 1. 根据 AgentScope 规范构造 HarnessAgent
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

        // 2. 构建 RuntimeContext 上下文
        RuntimeContext ctx = RuntimeContext.builder()
                .sessionId(agentUserCall != null && agentUserCall.sessionId() != null ? agentUserCall.sessionId() : "default_session")
                .userId("butvan")
                .build();

        String contextText = agentUserCall != null && agentUserCall.context() != null ? agentUserCall.context() : "";

        // 3. 订阅事件流并精准提取增量文本推送到 SSE 节点
        harnessAgent.streamEvents(new UserMessage(contextText), ctx)
                .doOnNext(event -> {
                    try {
                        String data = extractContent(event);
                        if (data != null && !data.isEmpty()) {
                            emitter.send(SseEmitter.event().data(data));
                        }
                    } catch (Exception e) {
                        log.error("推送 SSE 增量事件失败", e);
                        emitter.completeWithError(e);
                    }
                })
                .doOnError(error -> {
                    log.error("HarnessAgent 发生异常", error);
                    try {
                        emitter.send(SseEmitter.event().name("error").data("处理异常: " + error.getMessage()));
                    } catch (IOException ignored) {
                    }
                    emitter.completeWithError(error);
                })
                .doOnComplete(() -> {
                    log.info("HarnessAgent 对话流事件处理完成");
                    emitter.complete();
                })
                .subscribe();

        return emitter;
    }

    /**
     * 提炼 AgentScope 事件增量文本内容，自动过滤控制类事件
     *
     * @param event 事件对象
     * @return 纯文本（非文本增量事件返回 null 忽略）
     */
    private String extractContent(Object event) {
        if (event == null) return null;
        if (event instanceof String str) return str;

        String className = event.getClass().getSimpleName();

        // 过滤忽略 AgentScope 控制类与描述类事件
        if (className.contains("StartEvent") ||
            className.contains("EndEvent") ||
            className.contains("ResultEvent") ||
            className.contains("CallEvent")) {

            // 唯独 TextBlockDeltaEvent 包含文本增量片段，需深入提取
            if (!className.equals("TextBlockDeltaEvent")) {
                return null;
            }
        }

        try {
            var methods = event.getClass().getMethods();
            // 优先提取增量文本属性：text(), getText(), delta(), getDelta()
            for (var m : methods) {
                if (m.getParameterCount() == 0 &&
                   (m.getName().equals("text") || m.getName().equals("getText") ||
                    m.getName().equals("delta") || m.getName().equals("getDelta") ||
                    m.getName().equals("getTextContent"))) {
                    Object val = m.invoke(event);
                    if (val != null && !val.toString().isEmpty()) {
                        return val.toString();
                    }
                }
            }

            // 若嵌套有 Message 对象，递归解包
            for (var m : methods) {
                if (m.getParameterCount() == 0 && (m.getName().equals("getMsg") || m.getName().equals("message"))) {
                    Object msgObj = m.invoke(event);
                    if (msgObj != null) {
                        return extractContent(msgObj);
                    }
                }
            }
        } catch (Exception ignored) {
        }

        return null;
    }
}
