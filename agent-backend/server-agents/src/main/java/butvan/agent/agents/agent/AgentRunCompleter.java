package butvan.agent.agents.agent;

import butvan.agent.agents.agent.run.AgentRun;
import butvan.agent.agents.session.SessionCatalogService;
import butvan.agent.agents.session.TranscriptService;
import butvan.agent.agents.session.dto.TranscriptMessageDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

/**
 * Agent 流的终态收尾：在正常结束、失败或取消时仅追加一次完整 assistant 消息。
 */
@Component
@RequiredArgsConstructor
public class AgentRunCompleter {

    private final TranscriptService transcriptService;
    private final SessionCatalogService sessionCatalogService;


    /**
     * 结束一次运行并落库
     * @param run
     * @param status
     */
    public void complete(AgentRun run, TranscriptMessageDto.MessageStatus status) {
        if (!run.beginCompletion()) return;

        // 防止系统时钟微笑回拨产生负数
        long durationMillis = Math.max(0, Duration.between(run.startedAt(), Instant.now()).toMillis());

        try {
            // 固化工具状态并落库完整 assistant 消息
            transcriptService.appendAssistantMessage(
                    run.sessionId(),
                    run.turnId(),
                    run.contentAsString(),
                    run.thinkingAsString(),
                    status,
                    durationMillis,
                    run.finalizeTools(status),
                    run.tokenUsage()
            );
            run.commitCompletion();
        } catch (RuntimeException exception) {
            run.abortCompletion();
            throw exception;
        }

        // 侧边栏预览仍只使用最终正文
        sessionCatalogService.touch(run.sessionId(), run.contentAsString());
    }
}
