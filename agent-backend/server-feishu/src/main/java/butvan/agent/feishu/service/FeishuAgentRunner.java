package butvan.agent.feishu.service;

import butvan.agent.agents.agent.AgentService;
import butvan.agent.agents.agent.event.AgentStreamEvent;
import butvan.agent.agents.agent.AgentUserCall;
import butvan.agent.agents.session.AgentStreamSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

/**
 * 飞书场景的 Agent 调用器。
 *
 * <p>复用 AgentService 的流式编排，把事件队列收集成完整回复文本；
 * 飞书渠道不消费 SSE，因此这里只保留最终文本与终态信息。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FeishuAgentRunner {

    /** 单轮 Agent 处理的最长等待时间，超时后取消本次运行。 */
    private static final Duration AGENT_TIMEOUT = Duration.ofMinutes(5);

    private final AgentService agentService;

    /**
     * 运行一轮 Agent 并收集回复。
     *
     * @param sessionId 现有会话 ID
     * @param input     用户消息
     * @return 回复结果
     */
    public AgentReply runAndCollect(String sessionId, String input) {
        return runAndCollect(sessionId, input, null);
    }

    /**
     * 运行一轮 Agent 并收集回复，文本增量通过回调实时送出（用于流式卡片）。
     *
     * @param sessionId 现有会话 ID
     * @param input     用户消息
     * @param onDelta   收到文本增量时的回调，可为 null
     * @return 回复结果
     */
    public AgentReply runAndCollect(String sessionId, String input, Consumer<String> onDelta) {
        AgentStreamSession session = agentService.streamAgent(new AgentUserCall(sessionId, input));
        StringBuilder content = new StringBuilder();
        try {
            while (true) {
                AgentStreamEvent event = session.queue().poll(AGENT_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
                if (event == null) {
                    session.cancel();
                    return AgentReply.failed("Agent 处理超时，请稍后重试");
                }
                if (event instanceof AgentStreamEvent.TextDelta delta) {
                    content.append(delta.content());
                    if (onDelta != null) {
                        onDelta.accept(delta.content());
                    }
                } else if (event instanceof AgentStreamEvent.Completed) {
                    return AgentReply.ok(content.toString());
                } else if (event instanceof AgentStreamEvent.Failed failed) {
                    return AgentReply.failed(failed.message());
                } else if (event instanceof AgentStreamEvent.PermissionRequired permission) {
                    // 飞书渠道已显式授权“完全访问”：自动批准并恢复同一会话的运行，继续收集回复
                    try {
                        session = agentService.autoApproveAndResume(sessionId, permission.approvalId());
                    } catch (Exception e) {
                        log.error("飞书自动批准工具权限失败：sessionId={}, approvalId={}",
                                sessionId, permission.approvalId(), e);
                        return AgentReply.failed("权限自动确认失败，请稍后重试");
                    }
                }
                // ThinkingDelta、ToolCall、ToolResult 不进入飞书回复内容
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            session.cancel();
            log.warn("飞书 Agent 调用被中断：sessionId={}", sessionId);
            return AgentReply.failed("处理已被中断，请稍后重试");
        }
    }

    /** 飞书回复结果。 */
    public record AgentReply(String text, Kind kind) {

        public static AgentReply ok(String text) {
            return new AgentReply(text == null ? "" : text, Kind.OK);
        }

        public static AgentReply failed(String text) {
            return new AgentReply(text == null ? "处理失败，请稍后重试" : text, Kind.FAILED);
        }
    }

    /** 回复类型。 */
    public enum Kind {
        OK,
        FAILED
    }
}
