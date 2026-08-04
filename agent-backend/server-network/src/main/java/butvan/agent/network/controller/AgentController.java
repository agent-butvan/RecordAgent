package butvan.agent.network.controller;

import butvan.agent.agents.agent.AgentService;
import butvan.agent.agents.agent.AgentUserCall;
import butvan.agent.network.annotation.ApiLog;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

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
     * @param agentUserCall 用户提问请求体 (sessionId 与 context)
     * @return SseEmitter 事件流
     */
    @ApiLog("Agent对话SSE流式推流")
    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamChat(@RequestBody AgentUserCall agentUserCall) {
        log.info("收到 Agent 对话流式请求: sessionId={}, context={}",
                agentUserCall != null ? agentUserCall.sessionId() : null,
                agentUserCall != null ? agentUserCall.context() : null);
        return agentService.streamAgent(agentUserCall);
    }
}
