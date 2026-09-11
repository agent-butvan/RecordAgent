package butvan.agent.agents.agent.run;

import butvan.agent.agents.session.dto.TranscriptMessageDto;
import butvan.agent.agents.usage.TurnTokenUsage;

import java.time.Instant;
import java.util.List;

/** 一次尚未写入 transcript 的聊天轮次磁盘快照。 */
public record AgentRunCheckpoint(
        String sessionId,
        String turnId,
        Instant startedAt,
        Instant updatedAt,
        String content,
        String thinking,
        List<TranscriptMessageDto.ToolExecutionDto> tools,
        TurnTokenUsage usage
) {
    public AgentRunCheckpoint {
        content = content == null ? "" : content;
        thinking = thinking == null || thinking.isBlank() ? null : thinking;
        tools = tools == null ? List.of() : List.copyOf(tools);
    }
}
