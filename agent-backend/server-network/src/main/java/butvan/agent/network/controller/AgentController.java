package butvan.agent.network.controller;

import butvan.agent.agents.agent.AgentService;
import butvan.agent.agents.agent.AgentStreamEvent;
import butvan.agent.agents.agent.AgentUserCall;
import butvan.agent.agents.session.AgentStreamSession;
import butvan.agent.network.annotation.ApiLog;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
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

    /**
     * Agent 对话 SSE 流式接口
     *
     * @param request 用户提问请求体 (sessionId 与 context)
     * @return SseEmitter 事件流
     */
    @ApiLog("Agent对话SSE流式推流")
    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamChat(@RequestBody AgentUserCall request) {
        // 0L 表示由应用控制何时关闭，不让 Spring 因默认超时提前断开流。
        SseEmitter emitter = new SseEmitter(0L);
        // 此调用只创建队列和生产线程，会很快返回，不会阻塞 Controller 请求线程。
        AgentStreamSession session = agentService.streamAgent(request);

        // 发送线程专门负责“从队列取事件 → 写入 HTTP 响应”。
        Thread sender = Thread.startVirtualThread(() -> {
            try {
                // 客户端仍连接且线程未被中断时，持续等待下一条业务事件。
                while (!Thread.currentThread().isInterrupted()) {
                    // take() 在队列为空时等待；不需要手写轮询或 sleep。
                    AgentStreamEvent event = session.queue().take();
                    // SSE 同时写入 event 名称和 data 内容，浏览器据此区分事件类型。
                    emitter.send(SseEmitter.event()
                            .name(event.eventName())
                            .data(event.payload()));
                    // done/error 已经写出，跳出循环，finally 会做统一清理。
                    if (event.isTerminal()) {
                        return;
                    }
                }
            } catch (IOException | IllegalStateException exception) {
                // 常见于用户关闭页面或网络断开；记录调试日志即可，不再向已断开的客户端发送错误。
                log.debug("SSE 客户端已断开", exception);
            } catch (InterruptedException exception) {
                // onCompletion 触发 interrupt 后会来到这里；必须恢复中断标记。
                Thread.currentThread().interrupt();
            } finally {
                // 无论正常结束、异常还是断开，都通知生产者停止。
                session.cancel();
                // 关闭 HTTP SSE 响应，释放 Spring 侧资源。
                emitter.complete();
            }
        });

        emitter.onCompletion(() -> {
            // 浏览器主动关闭连接时，中断消费者线程。
            sender.interrupt();
            // 同时取消仍可能运行的 AgentScope 生产者线程。
            session.cancel();
        });

        return emitter;
    }
}
