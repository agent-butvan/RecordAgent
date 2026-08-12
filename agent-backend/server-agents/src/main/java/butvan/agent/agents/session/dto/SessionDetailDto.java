package butvan.agent.agents.session.dto;

import java.util.List;

/** 点击侧边栏一条会话后，后端返回的摘要和完整消息记录。 */
public record SessionDetailDto(
        SessionSummaryDto summary,
        List<TranscriptMessageDto> messages
) {
}