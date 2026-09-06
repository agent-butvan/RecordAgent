package butvan.agent.network.study.dto;

import java.time.Instant;

/** 学习记录 HTTP 请求 DTO 集合。 */
public final class StudyDtos {
    private StudyDtos() {
    }

    /** 开始学习请求。 */
    public record StartStudyRequest(String content, String category, String timezone) {
    }

    /** 补卡请求。 */
    public record ManualStudyRequest(
            String content, String category, Instant startedAt, Instant endedAt, String timezone) {
    }

    /** 修改学习记录请求。 */
    public record UpdateStudyRequest(
            String content, String category, Instant startedAt, Instant endedAt, String timezone) {
    }
}
