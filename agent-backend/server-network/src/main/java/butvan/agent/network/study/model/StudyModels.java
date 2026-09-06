package butvan.agent.network.study.model;

import butvan.agent.network.daily.model.DailyEventModels.DailyEventCommand;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/** 学习记录模块的领域值对象集合。 */
public final class StudyModels {

    private StudyModels() {
    }

    /** 创建或覆盖学习时段详情的领域命令。 */
    public record StudyCommand(
            LocalDate eventDate,
            String content,
            String category,
            Instant startedAt,
            Instant endedAt,
            ZoneId timezone) implements DailyEventCommand {
        @Override public String title() { return content; }
        @Override public String eventType() { return "study"; }
    }

    /** 日历等调用者可读取的学习类型详情。 */
    public record StudyDetails(String startedAt, String endedAt, String category, String timezone) {
    }

    /** 一段完整或进行中的学习时段。 */
    public record StudySession(
            String id,
            String content,
            String category,
            Instant startedAt,
            Instant endedAt,
            String timezone,
            String source,
            String status,
            long durationSeconds,
            int version) {
    }

    /** 单个自然日的学习汇总。 */
    public record StudyDayStat(LocalDate date, long durationSeconds, int sessionCount) {
    }

    /** 指定日期范围的学习统计。 */
    public record StudyStatistics(
            LocalDate from,
            LocalDate to,
            long totalDurationSeconds,
            long averageDailySeconds,
            int studyDays,
            int sessionCount,
            List<StudyDayStat> days) {
    }
}
