package butvan.agent.network.controller;

import butvan.agent.agents.agent.*;
import butvan.agent.agents.agent.event.AgentStreamEvent;
import butvan.agent.agents.agent.permission.PermissionDecisionRequest;
import butvan.agent.agents.agent.permission.PermissionDecisionResponse;
import butvan.agent.agents.agent.permission.PermissionResumeRequest;
import butvan.agent.agents.session.AgentStreamSession;
import butvan.agent.network.annotation.ApiLog;
import butvan.agent.network.dto.PlanResponse;
import butvan.agent.network.chat.dto.AgentChatRequest;
import butvan.agent.network.chat.service.AgentChatContextService;
import butvan.agent.network.chat.service.AgentAnalysisContextService;
import butvan.agent.agents.identity.CurrentUserProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;

/**
 * Agent 对话控制层 REST 接口
 */
@Slf4j
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/agent/chat")
@RequiredArgsConstructor
public class AgentController {

    private final AgentService agentService;
    private final AgentChatContextService agentChatContextService;
    private final AgentAnalysisContextService agentAnalysisContextService;
    private final CurrentUserProvider currentUserProvider;

    @ApiLog("提交单条工具权限确认")
    @PostMapping("/permission/decision")
    public PermissionDecisionResponse decidePermission(
            @RequestBody PermissionDecisionRequest request
    ) {
        return agentService.decidePermission(request);
    }

    @ApiLog("恢复已确认的Agent对话SSE流")
    @PostMapping(value = "/permission/resume", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter resumeChat(@RequestBody PermissionResumeRequest request) {
        AgentStreamSession session = agentService.resumeAgent(
                request.sessionId(), request.approvalId());
        return createEmitter(session); // 将原 streamChat 中的 emitter/发送线程逻辑提取到此方法。
    }

    @ApiLog("Agent对话SSE流式推流")
    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamChat(@RequestBody AgentChatRequest request) {
        // 初始对话流和确认后的恢复流共用同一套 SSE 发送/断开逻辑。
        String ownerId = currentUserProvider.currentUserId();
        AgentUserCall call = request.analysisContext() == null
                ? agentChatContextService.prepare(ownerId, request)
                : agentAnalysisContextService.prepare(ownerId, request);
        return createEmitter(agentService.streamAgent(call));
    }

    @ApiLog("读取当前会话的任务计划书")
    @GetMapping("/{sessionId}/plan")
    public ResponseEntity<PlanResponse> currentPlan(@PathVariable String sessionId) {
        String content = agentService.currentPlan(sessionId);
        // 没有计划书时返回 404，前端据此展示空态
        if (content == null || content.isBlank()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(new PlanResponse(content));
    }

    /**
     * 将 Agent 事件队列转发为 HTTP SSE，并统一处理客户端断开。
     *
     * @param session 已经启动生产者的 Agent 流会话
     * @return 返回给前端的 SSE 响应
     */
    private SseEmitter createEmitter(AgentStreamSession session) {
        // 0L 表示由应用控制何时关闭，避免 Spring 默认超时中断等待确认的流。
        SseEmitter emitter = new SseEmitter(0L);

        Thread sender = Thread.startVirtualThread(() -> {
            try {
                while (!Thread.currentThread().isInterrupted()) {
                    // 队列为空时阻塞等待；不会占用 CPU 轮询。
                    AgentStreamEvent event = session.queue().take();
                    emitter.send(SseEmitter.event()
                            .name(event.eventName())
                            .data(event.payload()));

                    // done、error、permission_required 都是当前 SSE 的终态事件。
                    if (event.isTerminal()) {
                        return;
                    }
                }
            } catch (IOException | IllegalStateException exception) {
                // 前端关闭页面或网络断开时，SseEmitter 可能抛出这些异常。
                log.debug("SSE 客户端已断开", exception);
            } catch (InterruptedException exception) {
                // onCompletion 会中断 sender；恢复中断标记以便 finally 正常释放资源。
                Thread.currentThread().interrupt();
            } finally {
                // 发送端结束后终止仍在等待模型或队列的生产者线程。
                session.cancel();
                emitter.complete();
            }
        });

        emitter.onCompletion(() -> {
            // 浏览器主动断开时，同时停止 SSE 消费线程与 Agent 生产线程。
            sender.interrupt();
            session.cancel();
        });

        return emitter;
    }
}
