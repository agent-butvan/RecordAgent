package butvan.agent.agents.session;

import butvan.agent.agents.session.dto.SessionSummaryDto;
import butvan.agent.agents.session.dto.TranscriptMessageDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/** 会话自动命名服务，封装幂等判断、模型调用、清洗与降级。 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SessionTitleService {

    private static final int MAX_TITLE_CODE_POINTS = 20;

    private final SessionCatalogService sessionCatalogService;
    private final TranscriptService transcriptService;
    private final ConversationTitleGenerator titleGenerator;

    /**
     * 若会话仍使用占位标题，则根据首个用户问题生成并持久化标题。
     * 模型不可用或返回异常内容时，稳定降级为首问摘要。
     */
    public SessionSummaryDto generateIfNeeded(String sessionId) {
        SessionSummaryDto current = sessionCatalogService.requireActive(sessionId);
        if (!"新对话".equals(current.title())) return current;

        String firstQuestion = transcriptService.list(sessionId).stream()
                .filter(message -> message.role() == TranscriptMessageDto.MessageRole.USER)
                .map(TranscriptMessageDto::content)
                .filter(content -> content != null && !content.isBlank())
                .findFirst()
                .orElse(null);
        if (firstQuestion == null) return current;

        String candidate;
        try {
            candidate = sanitize(titleGenerator.generate(sessionId, firstQuestion));
        } catch (RuntimeException exception) {
            log.warn("会话标题模型生成失败，使用首问摘要降级：sessionId={}", sessionId, exception);
            candidate = "";
        }
        if (candidate.isBlank()) candidate = sanitize(firstQuestion);
        return sessionCatalogService.updateGeneratedTitle(sessionId, candidate);
    }

    private String sanitize(String raw) {
        if (raw == null) return "";
        String value = raw.strip()
                .replaceAll("[\\r\\n]+", " ")
                .replaceAll("^[\\s`'\"“”‘’《》【】]+|[\\s`'\"“”‘’《》【】。！？!?]+$", "")
                .replaceFirst("^(标题|会话标题)\\s*[:：]\\s*", "")
                .replaceAll("\\s+", " ");
        int count = value.codePointCount(0, value.length());
        if (count <= MAX_TITLE_CODE_POINTS) return value;
        int end = value.offsetByCodePoints(0, MAX_TITLE_CODE_POINTS);
        return value.substring(0, end).strip();
    }
}
