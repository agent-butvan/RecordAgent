package butvan.agent.agents.agent;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.agents.model.ModelHolder;
import butvan.agent.agents.prompts.PromptBuilder;
import butvan.agent.agents.security.AgentSecurity;
import butvan.agent.agents.security.PermissionChecker;
import butvan.agent.agents.session.AgentStreamSession;
import butvan.agent.agents.session.SessionCatalogService;
import butvan.agent.agents.session.TranscriptService;
import butvan.agent.agents.session.dto.TranscriptMessageDto;
import butvan.agent.agents.storage.AgentStorageProperties;
import butvan.agent.agents.tool.ToolRegistry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.event.*;
import io.agentscope.core.message.UserMessage;
import io.agentscope.core.model.Model;
import io.agentscope.core.permission.PermissionMode;
import io.agentscope.core.state.AgentStateStore;
import io.agentscope.harness.agent.HarnessAgent;
import io.agentscope.harness.agent.memory.compaction.CompactionConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.file.Paths;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Agent 聊天流服务。
 *
 * <p>本类负责“应用会话 -> RuntimeContext -> AgentScope 事件流”的衔接；
 * Controller 只负责 SSE 协议，目录册和消息持久化分别交给专用服务。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentService {

    private final ModelHolder modelHolder;
    private final ToolRegistry toolRegistry;
    private final AgentSecurity agentSecurity;
    private final CurrentUserProvider currentUserProvider;
    private final SessionCatalogService sessionCatalogService;
    private final TranscriptService transcriptService;
    private final AgentStorageProperties storageProperties;
    private final AgentStateStore agentStateStore;

    /** 保留项目已有的权限策略；后续项目会话接入后应改为项目授权根目录。 */
    private final PermissionChecker permissionChecker = new PermissionChecker(
            PermissionMode.BYPASS,
            Paths.get(".").toAbsolutePath().normalize()
    );

    /** 只用于解析工具调用参数中的 command 字段。 */
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** 当前模型对应的 Agent 缓存；同一模型连续请求不会重复构建 Agent。 */
    private final AtomicReference<HarnessAgent> cachedAgent = new AtomicReference<>();

    /** 用对象引用识别 ModelHolder 是否已经切换了模型实例。 */
    private volatile Model cachedModel;

    /**
     * 创建一次 HTTP 流对应的队列和生产虚拟线程。
     *
     * <p>此方法立即返回，不能在 Controller 线程中等待模型结果。</p>
     */
    public AgentStreamSession streamAgent(AgentUserCall request) {
        AgentStreamSession streamSession = new AgentStreamSession();
        Thread producer = Thread.startVirtualThread(() -> produceEvents(request, streamSession));
        streamSession.bindProducer(producer);
        return streamSession;
    }

    /** 将 AgentScope 事件逐条转换为项目 SSE 事件，并在终态保存完整 assistant 消息。 */
    private void produceEvents(AgentUserCall request, AgentStreamSession streamSession) {
        StringBuilder assistantContent = new StringBuilder();
        // 本轮完整的thinking文本
        StringBuilder assistantThinking = new StringBuilder();

        /**
         * key 是 AgentScope 事件中的 toolCallId， value 是该工具当前累计的完整状态
         * LinkedHashMap 保留工具调用发生的先后顺序，便于历史界面俺原顺序展示
         */
        Map<String, TranscriptMessageDto.ToolExecutionDto> toolExecutions = new LinkedHashMap<>();

        String turnId = null;
        // 本轮耗时，从开始处理请求起计算
        Instant startedAt = Instant.now();

        try {
            if (request == null) {
                throw new IllegalArgumentException("聊天请求不能为空");
            }
            if (!modelHolder.isInitialized()) {
                putEvent(streamSession, new AgentStreamEvent.Failed("请先完成模型配置。"));
                return;
            }

            // 1. 先校验会话属于当前用户且仍可使用，不能让客户端伪造 sessionId。
            sessionCatalogService.requireActive(request.sessionId());
            String input = requireContent(request.context());

            // 2. 先持久化用户消息。即使模型失败，用户重新打开会话仍能看到自己发送了什么。
            turnId = transcriptService.appendUserMessage(request.sessionId(), input);
            RuntimeContext context = createRuntimeContext(request.sessionId());
            Map<String, StringBuilder> toolArgsBuffer = new ConcurrentHashMap<>();

            // 3. AgentScope 按 context 中的 (userId, sessionId) 自动恢复 AgentState。
            HarnessAgent agent = currentAgent();
            for (AgentEvent event : agent.streamEvents(new UserMessage(input), context).toIterable()) {
                if (streamSession.isCancelled()) {
                    // 取消时保留已输出文本，状态明确标记为 CANCELLED。
                    finishAssistantMessage(request.sessionId(), turnId, assistantContent, assistantThinking,
                            TranscriptMessageDto.MessageStatus.CANCELLED, startedAt, toolExecutions);
                    return;
                }

                AgentStreamEvent mappedEvent = mapEvent(event, toolArgsBuffer);
                if (mappedEvent instanceof AgentStreamEvent.TextDelta textDelta) {
                    assistantContent.append(textDelta.content());
                }
                if (mappedEvent instanceof AgentStreamEvent.ThinkingDelta thinkingDelta) {
                    assistantThinking.append(thinkingDelta.content());
                }
                collectToolExecution(mappedEvent, toolExecutions);

                if (mappedEvent != null && !putEvent(streamSession, mappedEvent)) {
                    finishAssistantMessage(request.sessionId(), turnId, assistantContent, assistantThinking,
                            TranscriptMessageDto.MessageStatus.CANCELLED, startedAt, toolExecutions);
                    return;
                }
                if (mappedEvent != null && mappedEvent.isTerminal()) {
                    finishAssistantMessage(request.sessionId(), turnId, assistantContent, assistantThinking,
                            mappedEvent instanceof AgentStreamEvent.Failed
                                    ? TranscriptMessageDto.MessageStatus.FAILED
                                    : TranscriptMessageDto.MessageStatus.COMPLETED, startedAt, toolExecutions);
                    return;
                }
            }

            // AgentEvent 流自然结束但未产生 AgentEndEvent 时，仍要给前端和消息记录一个完成状态。
            finishAssistantMessage(request.sessionId(), turnId, assistantContent, assistantThinking,
                    TranscriptMessageDto.MessageStatus.COMPLETED, startedAt, toolExecutions);
            putEvent(streamSession, new AgentStreamEvent.Completed());
        } catch (Exception exception) {
            if (streamSession.isCancelled() || Thread.currentThread().isInterrupted()) {
                Thread.currentThread().interrupt();
                if (turnId != null) {
                    finishAssistantMessage(request.sessionId(), turnId, assistantContent, assistantThinking,
                            TranscriptMessageDto.MessageStatus.CANCELLED, startedAt, toolExecutions);
                }
                return;
            }
            String sessionId = request == null ? null : request.sessionId();
            log.error("Agent 流处理失败: sessionId={}", sessionId, exception);
            if (turnId != null) {
                finishAssistantMessage(sessionId, turnId, assistantContent, assistantThinking,
                        TranscriptMessageDto.MessageStatus.FAILED, startedAt, toolExecutions);
            }
            putEvent(streamSession, new AgentStreamEvent.Failed(
                    exception instanceof IllegalArgumentException ? exception.getMessage() : "Agent 处理失败，请稍后重试。"
            ));
        }
    }

    /**
     * 汇总实时工具事件
     * @param event
     * @param toolExecutions
     */
    private void collectToolExecution(
            AgentStreamEvent event,
            Map<String, TranscriptMessageDto.ToolExecutionDto> toolExecutions
    ) {
        if (event instanceof AgentStreamEvent.ToolCall toolCall) {

            toolExecutions.compute(toolCall.toolCallId(), (k, previous) -> new TranscriptMessageDto.ToolExecutionDto(
                    toolCall.toolCallId(),
                    toolCall.toolName(),
                    toolCall.command().isBlank() && previous != null ? previous.command() : toolCall.command(),
                    previous == null ? "" : previous.output(),
                    TranscriptMessageDto.ToolStatus.RUNNING
            ));
            return;
        }

        if (event instanceof AgentStreamEvent.ToolResult toolResult) {

            toolExecutions.compute(toolResult.toolCallId(), (k, previous) -> new TranscriptMessageDto.ToolExecutionDto(
                    toolResult.toolCallId(),
                    toolResult.toolName(),
                    previous == null ? "" : previous.command(),
                    (previous == null ? "" : previous.output()) + toolResult.result(),
                    TranscriptMessageDto.ToolStatus.COMPLETED
            ));
        }
    }

    /**
     * 将尚未收到结果的 RUNNING 工具转换为最终状态
     * @param toolExecutions
     * @param messageStatus
     * @return
     */
    private List<TranscriptMessageDto.ToolExecutionDto> finalizeToolExecution(
            Map<String, TranscriptMessageDto.ToolExecutionDto> toolExecutions,
            TranscriptMessageDto.MessageStatus messageStatus
    ) {
        TranscriptMessageDto.ToolStatus fallbackStatus = switch (messageStatus) {
            case COMPLETED, FAILED -> TranscriptMessageDto.ToolStatus.FAILED;
            case CANCELLED -> TranscriptMessageDto.ToolStatus.CANCELLED;
        };

        return toolExecutions.values().stream()
                .map(tool -> tool.status() == TranscriptMessageDto.ToolStatus.RUNNING
                ? new TranscriptMessageDto.ToolExecutionDto(
                        tool.toolCallId(),
                        tool.toolName(),
                        tool.command(),
                        tool.output(),
                        fallbackStatus
                ) : tool)
                .toList();
    }

    /** 只在此处构造 RuntimeContext，保证所有 Agent 调用都使用同一个用户身份规则。 */
    private RuntimeContext createRuntimeContext(String sessionId) {
        return RuntimeContext.builder()
                .userId(currentUserProvider.currentUserId())
                .sessionId(sessionId)
                .build();
    }

    /**
     * 返回与当前 ModelHolder 模型相匹配的 Agent。
     *
     * <p>模型变更时会创建新 Agent；会话状态保存在独立的 agentStateStore 中，
     * 因此不会因 Agent 实例替换而丢失。</p>
     */
    private synchronized HarnessAgent currentAgent() {
        Model currentModel = modelHolder.getModel();
        HarnessAgent existingAgent = cachedAgent.get();
        if (existingAgent != null && cachedModel == currentModel) {
            return existingAgent;
        }

        // 模型切换后新建 Agent；AgentState 并不存于 Agent 实例，而是存于 agentStateStore，
        // 因此相同 sessionId 的上下文可以继续恢复。
        HarnessAgent newAgent = createHarnessAgent(currentModel);
        cachedModel = currentModel;
        cachedAgent.set(newAgent);
        return newAgent;
    }

    /** 构建 Agent 时只指定根目录和状态存储，不拼接任何 sessionDir。 */
    private HarnessAgent createHarnessAgent(Model model) {
        String modelName = model.getModelName() == null ? "unknown-model" : model.getModelName();
        String systemPrompt = PromptBuilder.buildDefaultSystemPrompt(
                modelName,
                System.getProperty("user.dir")
        );

        return HarnessAgent.builder()
                .name("butvan_agent")
                .sysPrompt(systemPrompt)
                .model(model)
                .toolkit(toolRegistry.getToolkit())
                .permissionContext(agentSecurity.createPermissionContext(permissionChecker))
                .workspace(storageProperties.getWorkspaceDirectory())
                .stateStore(agentStateStore)
                .compaction(CompactionConfig.builder()
                        .triggerMessages(30)
                        .keepMessages(10)
                        .build())
                .build();
    }

    /** 校验用户输入，避免空消息和异常大的请求进入模型。 */
    private String requireContent(String content) {
        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException("消息内容不能为空");
        }
        String normalized = content.strip();
        if (normalized.length() > 20_000) {
            throw new IllegalArgumentException("消息内容不能超过 20000 个字符");
        }
        return normalized;
    }

    /** 在流结束、失败或取消时仅追加一次完整 assistant 消息。 */
    private void finishAssistantMessage(
            String sessionId,
            String turnId,
            StringBuilder assistantContent,
            StringBuilder assistantThinking,
            TranscriptMessageDto.MessageStatus status,
            Instant statedAt,
            Map<String, TranscriptMessageDto.ToolExecutionDto> toolExecutions
    ) {
        String content = assistantContent.toString();
        String thiking = assistantThinking.toString();

        // 防止系统时钟微笑回拨产生负数
        long durationMills = Math.max(0, Duration.between(statedAt, Instant.now()).toMillis());

        transcriptService.appendAssistantMessage(
                sessionId,
                turnId,
                content,
                thiking,
                status,
                durationMills,
                finalizeToolExecution(toolExecutions, status)
        );

        // 侧边栏预览仍只使用最终正文，不把工具输出混入会话标题和预览
        sessionCatalogService.touch(sessionId, content);
    }

    /** 将 AgentScope 原始事件翻译为前端约定的 SSE 业务事件。 */
    private AgentStreamEvent mapEvent(AgentEvent event, Map<String, StringBuilder> toolArgsBuffer) {
        if (event instanceof TextBlockDeltaEvent textEvent) {
            return new AgentStreamEvent.TextDelta(textEvent.getDelta());
        }

        if (event instanceof ThinkingBlockDeltaEvent thinkingBlockDeltaEvent) {
            return new AgentStreamEvent.ThinkingDelta(
                    thinkingBlockDeltaEvent.getDelta()
            );
        }

        if (event instanceof AgentEndEvent) {
            return new AgentStreamEvent.Completed();
        }
        if (event instanceof ToolCallDeltaEvent toolCallDeltaEvent) {
            toolArgsBuffer.computeIfAbsent(toolCallDeltaEvent.getToolCallId(), ignored -> new StringBuilder())
                    .append(toolCallDeltaEvent.getDelta() == null ? "" : toolCallDeltaEvent.getDelta());
            return null;
        }
        if (event instanceof ToolCallStartEvent toolCallStartEvent) {
            return new AgentStreamEvent.ToolCall(
                    toolCallStartEvent.getToolCallId(),
                    toolCallStartEvent.getToolCallName(),
                    ""
            );
        }
        if (event instanceof ToolCallEndEvent toolCallEndEvent) {
            String rawArguments = String.valueOf(
                    toolArgsBuffer.remove(toolCallEndEvent.getToolCallId())
            );
            return new AgentStreamEvent.ToolCall(
                    toolCallEndEvent.getToolCallId(),
                    toolCallEndEvent.getToolCallName(),
                    parseCommandFromArguments(rawArguments)
            );
        }
        if (event instanceof ToolResultTextDeltaEvent toolResultEvent) {
            return new AgentStreamEvent.ToolResult(
                    toolResultEvent.getToolCallId(),
                    toolResultEvent.getToolCallName(),
                    toolResultEvent.getDelta()
            );
        }
        // 例如 thinking 等尚未接入 UI 的事件，在这里显式忽略。
        return null;
    }

    /** 尝试从工具参数 JSON 取 command；非 JSON 参数则原样返回供 UI 展示。 */
    private String parseCommandFromArguments(String rawArguments) {
        if (rawArguments == null || rawArguments.isBlank() || "null".equals(rawArguments)) {
            return "";
        }
        try {
            JsonNode node = objectMapper.readTree(rawArguments);
            return node.has("command") ? node.get("command").asText() : rawArguments;
        } catch (Exception exception) {
            return rawArguments;
        }
    }

    /** 将业务事件放进有界队列；客户端断开触发中断时立即停止生产。 */
    private boolean putEvent(AgentStreamSession streamSession, AgentStreamEvent event) {
        try {
            streamSession.queue().put(event);
            return true;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
}
