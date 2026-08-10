package butvan.agent.agents.agent;

import butvan.agent.agents.model.ModelHolder;
import butvan.agent.agents.prompts.PromptBuilder;
import butvan.agent.agents.security.AgentSecurity;
import butvan.agent.agents.security.PermissionChecker;
import butvan.agent.agents.security.PermissionMode;
import butvan.agent.agents.session.AgentStreamSession;
import butvan.agent.agents.tool.ToolRegistry;
import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.event.*;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.UserMessage;
import io.agentscope.core.model.Model;
import io.agentscope.harness.agent.HarnessAgent;
import io.agentscope.harness.agent.memory.compaction.CompactionConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.file.Paths;
import java.util.List;

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
    private final ToolRegistry toolRegistry;
    private final AgentSecurity agentSecurity;

    private final PermissionChecker permissionChecker = new PermissionChecker(
            PermissionMode.BYPASS,
            Paths.get(".").toAbsolutePath().normalize()
    );

    /**
     * 创建 Agent 流式会话，并在虚拟线程中启动 AgentScope 事件生产。
     *
     * @param request 用户对话请求
     * @return 可由网络层消费的流式会话
     */
    public AgentStreamSession streamAgent(AgentUserCall request) {
        // 为每次 HTTP 对话请求创建独立队列，不能复用其他用户的队列。
        AgentStreamSession session = new AgentStreamSession();

        // 立即启动虚拟线程，Controller 无需等待模型生成完成。
        Thread producer = Thread.startVirtualThread(() -> produceEvents(request, session));
        session.bindProducer(producer);
        return session;
    }

    /**
     * 消费 AgentScope 细粒度事件流，并转换为项目标准事件写入队列。
     *
     * @param request 用户对话请求
     * @param session 当前流式会话
     */
    private void produceEvents(AgentUserCall request, AgentStreamSession session) {
        if (!modelHolder.isInitialized()) {
            putEvent(session, new AgentStreamEvent.Failed("请先完成模型配置。"));
            return;
        }

        String input = request != null && request.context() != null ? request.context() : "";
        RuntimeContext context = createRuntimeContext(request);
        boolean terminalEventSent = false;

        try (HarnessAgent agent = createHarnessAgent(modelHolder.getModel())) {

            UserMessage message = new UserMessage(input);

            for (AgentEvent event : agent.streamEvents(message, context).toIterable()) {
                if (session.isCancelled()) return;
                AgentStreamEvent mappedEvent = mapEvent(event);
                if (mappedEvent == null) continue;
                if (!putEvent(session, mappedEvent)) return;
                if (mappedEvent.isTerminal()) {
                    terminalEventSent = true;
                    break;
                }
            }

            if (!terminalEventSent && !session.isCancelled()) {
                putEvent(session, new AgentStreamEvent.Completed());
            }

        } catch (Exception exception) {
            if (session.isCancelled() || Thread.currentThread().isInterrupted()) {
                Thread.currentThread().interrupt();
                return;
            }
            log.error("Agent 流处理失败: sessionId={}", context.getSessionId(), exception);
            putEvent(session, new AgentStreamEvent.Failed("Agent 处理失败，请稍后重试。"));
        }
    }

    /**
     * 将 AgentScope 原始事件转换为应用流事件。
     *
     * @param event AgentScope 原始事件
     * @return 应用流事件；不需要向前端输出的事件返回 {@code null}
     */
    private AgentStreamEvent mapEvent(AgentEvent event) {
        if (event instanceof TextBlockDeltaEvent textEvent) {
            // 文本增量只追加到聊天正文，不与内部控制事件混淆。
            return new AgentStreamEvent.TextDelta(textEvent.getDelta());
        }
        if (event instanceof AgentEndEvent) {
            // 生命周期结束
            return new AgentStreamEvent.Completed();
        }
        if (event instanceof ToolCallStartEvent toolCallStartEvent) {
            return new AgentStreamEvent.ToolCall(toolCallStartEvent.getToolCallName());
        }
        if (event instanceof ToolResultTextDeltaEvent toolResultTextDeltaEvent) {
            return new AgentStreamEvent.ToolResult(toolResultTextDeltaEvent.getDelta());
        }

        return null;
    }

    /**
     * 根据请求创建隔离 AgentScope 会话记忆的运行上下文。
     *
     * @param request 用户对话请求
     * @return 运行上下文
     */
    private RuntimeContext createRuntimeContext(AgentUserCall request) {
        String sessionId = request != null && request.sessionId() != null && !request.sessionId().isBlank()
                ? request.sessionId() : "default_session";

        return RuntimeContext.builder()
                .sessionId(sessionId)
                .userId("butvan")
                .build();
    }

    /**
     * 创建当前模型对应的 HarnessAgent。
     *
     * @param model 当前激活模型
     * @return HarnessAgent 实例
     */
    private HarnessAgent createHarnessAgent(Model model) {

        String modelName = model.getModelName() != null ? model.getModelName() : "unknown-model";
        String workDir = System.getProperty("user.dir");
        String sysPrompt = PromptBuilder.buildDefaultSystemPrompt(modelName, workDir);

        return HarnessAgent.builder()
                .name("butvan_agent")
                .sysPrompt(sysPrompt)
                .model(model)
                .toolkit(toolRegistry.getToolkit())
                .permissionContext(agentSecurity.createPermissionContext(permissionChecker))
                .workspace(Paths.get(".agentscope/workspace"))
                .compaction(CompactionConfig.builder()
                        .triggerMessages(30)
                        .keepMessages(10)
                        .build())
                .build();
    }

    /**
     * 向队列写入事件，并正确保留线程中断信号。
     *
     * @param session 流式会话
     * @param event   待发送事件
     * @return 写入成功时返回 {@code true}
     */
    private boolean putEvent(AgentStreamSession session, AgentStreamEvent event) {
        try {
            session.queue().put(event);
            return true;
        } catch (InterruptedException exception) {
            // 保留停止信号，调用方据此停止生产。
            Thread.currentThread().interrupt();
            return false;
        }
    }
}
