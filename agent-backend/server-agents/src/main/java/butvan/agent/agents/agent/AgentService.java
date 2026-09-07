package butvan.agent.agents.agent;

import butvan.agent.agents.agent.event.AgentStreamEvent;
import butvan.agent.agents.agent.permission.*;
import butvan.agent.agents.agent.run.AgentRun;
import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.agents.model.ModelHolder;
import butvan.agent.agents.model.ModelSelector;
import butvan.agent.agents.session.AgentStreamSession;
import butvan.agent.agents.session.SessionCatalogService;
import butvan.agent.agents.session.TranscriptService;
import butvan.agent.agents.session.dto.TranscriptMessageDto;
import butvan.agent.agents.session.dto.SessionPermissionMode;
import butvan.agent.agents.security.AgentSecurity;
import butvan.agent.agents.usage.ModelIdentity;
import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.event.*;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.MsgRole;
import io.agentscope.core.message.ToolUseBlock;
import io.agentscope.core.message.UserMessage;
import io.agentscope.harness.agent.HarnessAgent;
import io.agentscope.core.permission.PermissionMode;
import io.agentscope.harness.agent.workspace.plan.PlanModeManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

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
    private final CurrentUserProvider currentUserProvider;
    private final SessionCatalogService sessionCatalogService;
    private final TranscriptService transcriptService;
    // 保存等待用户确认的批次，以及当前会话的精确授权记忆。
    private final PendingApprovalStore pendingApprovalStore;
    private final AgentEventManager agentEventManager;
    private final AgentFactory agentFactory;
    private final AgentSecurity agentSecurity;
    private final AgentRunCompleter agentRunCompleter;

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

    /**
     * 创建一次 HTTP 流对应的队列和生产虚拟线程
     * 此方法立即返回
     * @param request
     * @param streamSession
     */
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

            // 2. 用户消息只在初始化请求时保存一次，回复确认时不再重复保存
            String turnId = transcriptService.appendUserMessage(request.sessionId(), input);
            String userId = currentUserProvider.currentUserId();
            RuntimeContext context = createRuntimeContext(request.sessionId());
            run = new AgentRun(request.sessionId(), userId, turnId, context);

            // 3. 初始调用将用户消息交给 AgentScope；后续回复会传入确认消息
            runAgentStream(run, List.of(new UserMessage(input)), streamSession);
        } catch (Exception e) {
            // 客户端已断开，按照取消收尾
            if (streamSession.isCancelled() || Thread.currentThread().isInterrupted()) {
                Thread.currentThread().interrupt();
                if (run != null) {
                    agentRunCompleter.complete(run, TranscriptMessageDto.MessageStatus.CANCELLED);
                }
                return;
            }

            // 处理失败：按照失败收尾并回传安全错误文案
            String sessionId = request == null ? null : request.sessionId();
            log.error("Agent 流处理失败：sessionId={}",sessionId,e);
            if (run != null) {
                agentRunCompleter.complete(run, TranscriptMessageDto.MessageStatus.FAILED);
            }
            String userMessage = e instanceof IllegalArgumentException ? e.getMessage() : "Agent处理失败，请稍后重试";
            if (run != null && isWaitingForPermission(run, e)) {
                userMessage = "该会话仍有操作等待桌面端权限确认，请现在 ButvanAgent 桌面端处理后再继续";
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

    /**
     * 消费 AgentScope 事件流
     * 先识别 RequireUserConfirmEvent 再走普通映射
     * @param run
     * @param inputMessages
     * @param streamSession
     */
    private void runAgentStream(AgentRun run, List<Msg> inputMessages, AgentStreamSession streamSession) {
        HarnessAgent agent = agentFactory.currentAgent();
        ModelIdentity modelIdentity = currentModelIdentity();
        SessionPermissionMode productMode = sessionCatalogService.getPermissionMode(run.sessionId());
        agent.getDelegate().getAgentState(run.userId(), run.sessionId())
                .setPermissionContext(agentSecurity.createPermissionContext(productMode));
        // setPermissionMode 同时重建当前会话的权限引擎并持久化新的上下文。
        agent.setPermissionMode(run.userId(), run.sessionId(), toAgentScopeMode(productMode));

        for (AgentEvent event : agent.streamEvents(inputMessages,
                run.runtimeContext()).toIterable()) {
            // Token usage 必须在 UI 映射之前采集，包含工具循环和子 Agent 原始事件。
            run.recordModelEvent(event, modelIdentity);

            // 客户端断开：立即按取消收尾
            if (streamSession.isCancelled()) {
                agentRunCompleter.complete(run, TranscriptMessageDto.MessageStatus.CANCELLED);
                return;
            }

            // 必须在普通映射之前识别该事件
            if (event instanceof RequireUserConfirmEvent confirmEvent) {
                if (pauseForConfirmation(run, confirmEvent.getToolCalls(), streamSession)) {
                    return;
                }
                continue;
            }

            AgentStreamEvent mapped = agentEventManager.map(event, run.toolArgsBuffer());
            run.record(mapped);
            if (mapped != null && mapped.isTerminal()) {
                // 先持久化再发送终态，确保前端收到 done 后能立即读取完整消息与 usage。
                agentRunCompleter.complete(run, TranscriptMessageDto.MessageStatus.COMPLETED);
                putEvent(streamSession, mapped);
                return;
            }
            if (mapped != null && !putEvent(streamSession, mapped)) {
                agentRunCompleter.complete(run, TranscriptMessageDto.MessageStatus.CANCELLED);
                return;
            }
        }

        // 事件流自然结束：正常收尾
        agentRunCompleter.complete(run, TranscriptMessageDto.MessageStatus.COMPLETED);
        putEvent(streamSession, new AgentStreamEvent.Completed());
    }

    /** 将产品文案稳定映射到 AgentScope 的运行模式。 */
    private PermissionMode toAgentScopeMode(SessionPermissionMode mode) {
        return switch (mode) {
            case ASK -> PermissionMode.DEFAULT;
            case AUTO_EDIT -> PermissionMode.ACCEPT_EDITS;
            case FULL_ACCESS -> PermissionMode.BYPASS;
        };
    }

    /**
     * 优先应用已经记住的决定，未解决的工具进入待确认批次
     * @param run
     * @param askedTools
     * @param streamSession
     * @return
     */
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

    /**
     * 构建携带 ConfirmResult 的恢复消息，不是用户新提问
     * @param results
     * @return
     */
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

                agentRunCompleter.complete(approval.run(), TranscriptMessageDto.MessageStatus.FAILED);

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
        HarnessAgent agent = agentFactory.currentAgent();
        RuntimeContext context = createRuntimeContext(sessionId);
        // 计划文件默认位于工作区 plans/PLAN.md
        String planPath = PlanModeManager.DEFAULT_PLAN_DIR + "/PLAN.md";
        return agent.getWorkspaceManager()
                .readManagedWorkspaceFileUtf8(context, planPath);
    }



    /** 只在此处构造 RuntimeContext，保证所有 Agent 调用都使用同一个用户身份规则。 */
    private RuntimeContext createRuntimeContext(String sessionId) {
        return RuntimeContext.builder()
                .userId(currentUserProvider.currentUserId())
                .sessionId(sessionId)
                .build();
    }

    /** 每段 Agent 流开始时固化模型身份，兼容权限暂停期间切换模型的情况。 */
    private ModelIdentity currentModelIdentity() {
        ModelSelector selector = modelHolder.getCurrentSelector();
        String vendor = selector == null ? null : selector.vendor();
        return new ModelIdentity(vendor, modelHolder.getModel().getModelName());
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


    /**
     * 事件入队
     * 客户端断开触发中断时立即停止生产
     * @param streamSession
     * @param event
     * @return
     */
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
