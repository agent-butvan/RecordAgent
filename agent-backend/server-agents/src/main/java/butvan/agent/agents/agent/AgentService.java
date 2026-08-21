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
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.MsgRole;
import io.agentscope.core.message.ToolUseBlock;
import io.agentscope.core.message.UserMessage;
import io.agentscope.core.model.Model;
import io.agentscope.core.permission.PermissionMode;
import io.agentscope.core.state.AgentStateStore;
import io.agentscope.harness.agent.HarnessAgent;
import io.agentscope.harness.agent.memory.compaction.CompactionConfig;
import io.agentscope.harness.agent.workspace.plan.PlanModeManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.file.Paths;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
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
            PermissionMode.DEFAULT,
            Paths.get(".").toAbsolutePath().normalize()
    );

    /** 只用于解析工具调用参数中的 command 字段。 */
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** 当前模型对应的 Agent 缓存；同一模型连续请求不会重复构建 Agent。 */
    private final AtomicReference<HarnessAgent> cachedAgent = new AtomicReference<>();

    /** 用对象引用识别 ModelHolder 是否已经切换了模型实例。 */
    private volatile Model cachedModel;

    // 保存等待用户确认的批次，以及当前会话的精确授权记忆。
    private final PendingApprovalStore pendingApprovalStore;

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
        AgentRun run = null;
        try {
            if (request == null) throw new IllegalArgumentException("聊天请求不能为空");
            if (!modelHolder.isInitialized()) {
                putEvent(streamSession, new AgentStreamEvent.Failed("请先完成模型配置"));
                return;
            }

            // 1. 防止客户端伪造或使用已删除的会话
            sessionCatalogService.requireActive(request.sessionId());
            String input = requireContent(request.context());

            // 2. 用户消息只在初始化请求时保存一次来回复确认时候不能再次保存它
            String turnId = transcriptService.appendUserMessage(request.sessionId(), input);
            String userId = currentUserProvider.currentUserId();
            RuntimeContext context = createRuntimeContext(request.sessionId());
            run = new AgentRun(request.sessionId(), userId, turnId, context);

            // 3. 初始调用将用户消息交给 AgentScope；后续恢复会传入确认消息
            runAgentStream(run, List.of(new UserMessage(input)), streamSession);
        } catch (Exception e) {
            if (streamSession.isCancelled() || Thread.currentThread().isInterrupted()) {
                Thread.currentThread().interrupt();
                if (run != null) {
                    finishCancelledRun(run);
                }
                return;
            }

            String sessionId = request == null ? null : request.sessionId();
            log.error("Agent 流失处理失败：sessionId={}",sessionId, e);
            if (run != null) {
                finishAssistantMessage(run.sessionId(), run.turnId(), run.content(), run.thinking(),
                        TranscriptMessageDto.MessageStatus.FAILED,
                        run.startedAt(), run.toolExecutions()
                        );
            }
            String userMessage = e instanceof IllegalArgumentException
                    ? e.getMessage()
                    : "Agent处理失败，请稍后重试";
            if (run != null && isWaitingForPermission(run, e)) {
                userMessage = "该会话仍有操作等待桌面端权限确认，请先在 ButvanAgent 桌面端处理后再继续";
            }
            putEvent(streamSession, new AgentStreamEvent.Failed(userMessage));
        }
    }

    /**
     * 判断失败是否由“待确认的权限审批”引起。
     *
     * <p>优先查待确认存储；再兼容框架 paused for human-in-the-loop 异常信息，
     * 避免会话残留 ASKING 状态时向用户暴露框架异常。</p>
     */
    private boolean isWaitingForPermission(AgentRun run, Exception e) {
        if (pendingApprovalStore.hasPending(run.userId(), run.sessionId())) {
            return true;
        }
        return e instanceof IllegalStateException
                && e.getMessage() != null
                && e.getMessage().contains("paused for human-in-the-loop");
    }

    private void runAgentStream(AgentRun run, List<Msg> inputMessages, AgentStreamSession streamSession) {
        HarnessAgent agent = currentAgent();

        for (AgentEvent event : agent.streamEvents(inputMessages, run.runtimeContext()).toIterable()) {
            if (streamSession.isCancelled()) {
                finishCancelledRun(run);
                return;
            }

            // 必须在普通 mapEvent 之前识别该事件
            if (event instanceof RequireUserConfirmEvent confirmEvent) {
                if (pauseForConfirmation(run, confirmEvent.getToolCalls(), streamSession)) {
                    return;
                }
                continue;
            }

            AgentStreamEvent mapped = mapEvent(event, run.toolArgsBuffer());
            appendAndCollect(run, mapped); // 复用原油正文/thinking/工具记录累计逻辑
            if (mapped != null && !putEvent(streamSession, mapped)) {
                finishCancelledRun(run);
                return;
            }
            if (mapped != null && mapped.isTerminal()) {
                finishCompletedRun(run);
                return;
            }
        }

        finishCompletedRun(run);
        putEvent(streamSession, new AgentStreamEvent.Completed());
    }

    private boolean pauseForConfirmation(AgentRun run, List<ToolUseBlock> askedTools, AgentStreamSession streamSession) {
        List<ConfirmResult> rememberResults = new ArrayList<>();
        List<ToolUseBlock> unresolved = new ArrayList<>();

        for (ToolUseBlock tool : askedTools) {
            Optional<Boolean> remembered = pendingApprovalStore.remembered(
                    run.userId(),
                    run.sessionId(),
                    tool
            );
            if (remembered.isPresent()) {
                // 已记住也要走 ConfirmResult，不能跳过 AgentScope 的状态恢复流程
                rememberResults.add(new ConfirmResult(remembered.get(), tool));
            } else {
                unresolved.add(tool);
            }
        }

        if (unresolved.isEmpty()) {
            Msg resumeMessage = buildResumeMessage(rememberResults);
            runAgentStream(run, List.of(resumeMessage), streamSession);
            return true;
        }

        // 已记住的结果也放入统一 PendingApproval，确保最终一次恢复包含整批工具的结果
        PendingApproval approval = new PendingApproval(run, askedTools);
        rememberResults.forEach(result -> approval.decide(
                result.getToolCall().getId(), result.isConfirmed()
        ));
        pendingApprovalStore.save(approval);

        PermissionToolDto first = approval.nextTool();
        return putEvent(
                streamSession,
                new AgentStreamEvent.PermissionRequired(approval.approvalId(), first)
        );
    }

    public PermissionDecisionResponse decidePermission(PermissionDecisionRequest request) {
        String userId = currentUserProvider.currentUserId();
        sessionCatalogService.requireActive(request.sessionId());
        PendingApproval approval = pendingApprovalStore.require(
                request.approvalId(), userId, request.sessionId());

        approval.decide(request.toolCallId(), request.approved());

        if (request.rememberForSession()) {
            ToolUseBlock tool = approval.findTool(request.toolCallId());
            // 记住的仅是这一组完全相同的参数；不写 YAML，不影响其他会话。
            pendingApprovalStore.remember(userId, request.sessionId(), tool, request.approved());
        }

        PermissionToolDto next = approval.nextTool();
        return next == null ? PermissionDecisionResponse.ready()
                : PermissionDecisionResponse.next(next);
    }

    /**
     * 自动批准某次权限确认并恢复运行（供已显式授权的全权限渠道使用）。
     *
     * @param sessionId  会话 ID
     * @param approvalId 待确认批次 ID
     * @return 恢复后的 Agent 流
     */
    public AgentStreamSession autoApproveAndResume(String sessionId, String approvalId) {
        String userId = currentUserProvider.currentUserId();
        PendingApproval approval = pendingApprovalStore.require(approvalId, userId, sessionId);
        approval.approveAll();
        log.info("自动批准工具权限：sessionId={}, approvalId={}, 工具数={}",
                sessionId, approvalId, approval.toolCount());
        return resumeAgent(sessionId, approvalId);
    }

    private Msg buildResumeMessage(List<ConfirmResult> results) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put(Msg.METADATA_CONFIRM_RESULTS, results);

        // 这是框架恢复信号，不是用户的新提问。
        return Msg.builder()
                .name("user")
                .role(MsgRole.USER)
                .textContent("permission confirmation received")
                .metadata(metadata)
                .build();
    }

    public AgentStreamSession resumeAgent(String sessionId, String approvalId) {
        String userId = currentUserProvider.currentUserId();
        PendingApproval approval = pendingApprovalStore.require(approvalId, userId, sessionId);
        if (!approval.allDecided()) {
            throw new IllegalArgumentException("请先逐条完成所有工具确认");
        }

        AgentStreamSession streamSession = new AgentStreamSession();
        Thread producer = Thread.startVirtualThread(() -> {
            try {
                runAgentStream(approval.run(),
                        List.of(buildResumeMessage(approval.toConfirmResults())), streamSession);
            } catch (Exception exception) {
                log.error("恢复 Agent 流失败: sessionId={}, approvalId={}", sessionId, approvalId, exception);
                finishAssistantMessage(approval.run().sessionId(), approval.run().turnId(),
                        approval.run().content(), approval.run().thinking(),
                        TranscriptMessageDto.MessageStatus.FAILED,
                        approval.run().startedAt(), approval.run().toolExecutions());
                putEvent(streamSession, new AgentStreamEvent.Failed("恢复 Agent 处理失败，请重新发起任务。"));
            } finally {
                // 无论恢复成功还是失败，该批次都不能再次提交。
                pendingApprovalStore.remove(approvalId);
            }
        });
        streamSession.bindProducer(producer);
        return streamSession;
    }

    /**
     * 读取当前会话的任务计划书
     * @param sessionId
     * @return
     */
    public String currentPlan(String sessionId) {
        // 复用会话有效性校验，防止读取已删除会话的文件
        sessionCatalogService.requireActive(sessionId);
        if (!modelHolder.isInitialized()) return "";
        HarnessAgent agent = currentAgent();
        RuntimeContext context = createRuntimeContext(sessionId);
        // 计划文件默认位于工作区 plans/PLAN.md
        String planPath = PlanModeManager.DEFAULT_PLAN_DIR + "/PLAN.md";
        return agent.getWorkspaceManager()
                .readManagedWorkspaceFileUtf8(context, planPath);
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
                .enablePlanMode() // 开启计划模式
                .planFileDirectory("plans")
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
        String thinking = assistantThinking.toString();

        // 防止系统时钟微笑回拨产生负数
        long durationMills = Math.max(0, Duration.between(statedAt, Instant.now()).toMillis());

        transcriptService.appendAssistantMessage(
                sessionId,
                turnId,
                content,
                thinking,
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


    private void appendAndCollect(AgentRun run, AgentStreamEvent event) {
        if (event instanceof AgentStreamEvent.TextDelta text) {
            run.content().append(text.content());
        } else if (event instanceof AgentStreamEvent.ThinkingDelta thinking) {
            run.thinking().append(thinking.content());
        }
        collectToolExecution(event, run.toolExecutions());
    }

    private void finishCompletedRun(AgentRun run) {
        finishAssistantMessage(run.sessionId(), run.turnId(), run.content(), run.thinking(),
                TranscriptMessageDto.MessageStatus.COMPLETED,
                run.startedAt(), run.toolExecutions());
    }

    private void finishCancelledRun(AgentRun run) {
        finishAssistantMessage(run.sessionId(), run.turnId(), run.content(), run.thinking(),
                TranscriptMessageDto.MessageStatus.CANCELLED,
                run.startedAt(), run.toolExecutions());
    }
}
