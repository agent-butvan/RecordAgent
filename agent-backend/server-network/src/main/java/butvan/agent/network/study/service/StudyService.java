package butvan.agent.network.study.service;

import butvan.agent.network.daily.repository.DailyEventRepository;
import butvan.agent.network.daily.repository.DailyEventRepository.DailyEventRow;
import butvan.agent.network.daily.type.DailyEventTypeRegistry;
import butvan.agent.network.study.event.StudySessionChangedEvent;
import butvan.agent.network.study.event.StudySessionChangedEvent.ChangeType;
import butvan.agent.network.study.model.StudyModels.StudyCommand;
import butvan.agent.network.study.model.StudyModels.StudyDayStat;
import butvan.agent.network.study.model.StudyModels.StudySession;
import butvan.agent.network.study.model.StudyModels.StudyStatistics;
import butvan.agent.network.study.repository.StudyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** 学习时段公开领域接口，统一项目内打卡、补卡及统计口径。 */
@Service
@RequiredArgsConstructor
public class StudyService {
    private final DailyEventRepository dailyEventRepository;
    private final DailyEventTypeRegistry typeRegistry;
    private final StudyRepository studyRepository;
    private final ApplicationEventPublisher eventPublisher;

    /** 立即开始一段学习。 */
    @Transactional
    public StudySession start(String ownerId, String content, String category, ZoneId timezone) {
        validateOwner(ownerId);
        Instant now = Instant.now();
        if (studyRepository.findActive(ownerId, now).isPresent()) {
            throw new IllegalArgumentException("已有进行中的学习，请先结束后再开始");
        }
        StudyCommand command = command(content, category, now, null, timezone, null);
        studyRepository.rememberCategory(ownerId, command.category(), now);
        String id = UUID.randomUUID().toString();
        try {
            dailyEventRepository.insertEvent(id, ownerId, command.eventDate(), "study", cleanContent(content),
                    "project", null, "active", now);
            typeRegistry.insert(id, command);
        } catch (DataIntegrityViolationException exception) {
            throw new IllegalArgumentException("已有进行中的学习，请刷新后重试", exception);
        }
        StudySession created = requireSession(ownerId, id, now);
        publishChanged(ownerId, id, ChangeType.STARTED);
        return created;
    }

    /** 以当前服务时间结束指定的进行中学习。 */
    @Transactional
    public StudySession finish(String ownerId, String eventId, int expectedVersion) {
        validateOwner(ownerId);
        Instant now = Instant.now();
        StudySession existing = requireSession(ownerId, eventId, now);
        if (!"active".equals(existing.status()) || existing.endedAt() != null) {
            throw new IllegalArgumentException("该学习时段已经结束");
        }
        if (!existing.startedAt().isBefore(now)) throw new IllegalArgumentException("学习结束时间必须晚于开始时间");
        if (studyRepository.hasOverlap(ownerId, existing.startedAt(), now, eventId, now)) {
            throw new IllegalArgumentException("该学习时段与其他记录重叠，请先调整补卡记录");
        }
        StudyCommand command = command(existing.content(), existing.category(), existing.startedAt(), now,
                ZoneId.of(existing.timezone()), existing.location());
        typeRegistry.update(eventId, command);
        if (!dailyEventRepository.updateEvent(ownerId, eventId, expectedVersion, command.eventDate(),
                cleanContent(existing.content()), "completed", now)) {
            throw new IllegalStateException("学习记录已被其他操作修改，请刷新后重试");
        }
        StudySession finished = requireSession(ownerId, eventId, now);
        publishChanged(ownerId, eventId, ChangeType.FINISHED);
        return finished;
    }

    /** 补录一段已结束的学习。 */
    @Transactional
    public StudySession createManual(
            String ownerId, String content, String category, Instant startedAt, Instant endedAt, ZoneId timezone, String location) {
        validateOwner(ownerId);
        Instant now = Instant.now();
        StudyCommand command = command(content, category, startedAt, endedAt, timezone, cleanLocation(location));
        validateCompletedTime(endedAt, now);
        if (studyRepository.hasOverlap(ownerId, startedAt, endedAt, null, now)) {
            throw new IllegalArgumentException("补卡时间与已有学习记录重叠");
        }
        String id = UUID.randomUUID().toString();
        studyRepository.rememberCategory(ownerId, command.category(), now);
        dailyEventRepository.insertEvent(id, ownerId, command.eventDate(), "study", cleanContent(content),
                "manual", null, "completed", now);
        typeRegistry.insert(id, command);
        StudySession created = requireSession(ownerId, id, now);
        publishChanged(ownerId, id, ChangeType.CREATED);
        return created;
    }

    /** 修改一段已结束学习的内容和时间。 */
    @Transactional
    public StudySession update(
            String ownerId, String eventId, int expectedVersion, String content, String category,
            Instant startedAt, Instant endedAt, ZoneId timezone, String location) {
        validateOwner(ownerId);
        Instant now = Instant.now();
        StudySession existing = requireSession(ownerId, eventId, now);
        if (existing.endedAt() == null) throw new IllegalArgumentException("进行中的学习请先结束再修改");
        StudyCommand command = command(content, category, startedAt, endedAt, timezone, cleanLocation(location));
        validateCompletedTime(endedAt, now);
        if (studyRepository.hasOverlap(ownerId, startedAt, endedAt, eventId, now)) {
            throw new IllegalArgumentException("修改后的时间与已有学习记录重叠");
        }
        studyRepository.rememberCategory(ownerId, command.category(), now);
        typeRegistry.update(eventId, command);
        if (!dailyEventRepository.updateEvent(ownerId, eventId, expectedVersion, command.eventDate(),
                cleanContent(content), "completed", now)) {
            throw new IllegalStateException("学习记录已被其他操作修改，请刷新后重试");
        }
        StudySession updated = requireSession(ownerId, eventId, now);
        publishChanged(ownerId, eventId, ChangeType.UPDATED);
        return updated;
    }

    /** 删除一段学习记录。 */
    @Transactional
    public void delete(String ownerId, String eventId, int expectedVersion) {
        validateOwner(ownerId);
        DailyEventRow event = dailyEventRepository.findById(ownerId, eventId)
                .orElseThrow(() -> new IllegalArgumentException("学习记录不存在"));
        if (!"study".equals(event.eventType())) throw new IllegalArgumentException("指定记录不是学习记录");
        if (!dailyEventRepository.delete(ownerId, eventId, expectedVersion)) {
            throw new IllegalStateException("学习记录已被其他操作修改，请刷新后重试");
        }
        publishChanged(ownerId, eventId, ChangeType.DELETED);
    }

    /** 查询进行中的学习。 */
    @Transactional(readOnly = true)
    public StudySession getActive(String ownerId) {
        validateOwner(ownerId);
        return studyRepository.findActive(ownerId, Instant.now()).orElse(null);
    }

    /** 按所有者和稳定 ID 查询单条学习时段。 */
    @Transactional(readOnly = true)
    public StudySession getSession(String ownerId, String eventId) {
        validateOwner(ownerId);
        return requireSession(ownerId, eventId, Instant.now());
    }

    /** 查询用户使用过的学习分类。 */
    @Transactional(readOnly = true)
    public List<String> getCategories(String ownerId) {
        validateOwner(ownerId);
        return studyRepository.findCategories(ownerId);
    }

    /** 查询与自然日期范围相交的学习时段。 */
    @Transactional(readOnly = true)
    public List<StudySession> getSessions(String ownerId, LocalDate from, LocalDate to, ZoneId timezone) {
        validateRange(ownerId, from, to, timezone);
        Instant rangeStart = from.atStartOfDay(timezone).toInstant();
        Instant rangeEnd = to.plusDays(1).atStartOfDay(timezone).toInstant();
        return studyRepository.findRange(ownerId, rangeStart, rangeEnd, Instant.now());
    }

    /** 按每段记录自身时区拆分并统计指定自然日期范围。 */
    @Transactional(readOnly = true)
    public StudyStatistics getStatistics(String ownerId, LocalDate from, LocalDate to, ZoneId queryTimezone) {
        List<StudySession> sessions = getSessions(ownerId, from, to, queryTimezone);
        Instant now = Instant.now();
        Map<LocalDate, MutableDayStat> days = new LinkedHashMap<>();
        for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) days.put(date, new MutableDayStat());
        for (StudySession session : sessions) {
            splitSession(session, from, to, now, days);
        }
        List<StudyDayStat> dayStats = days.entrySet().stream()
                .map(entry -> new StudyDayStat(entry.getKey(), entry.getValue().seconds, entry.getValue().sessionCount))
                .toList();
        long total = dayStats.stream().mapToLong(StudyDayStat::durationSeconds).sum();
        int studyDays = (int) dayStats.stream().filter(day -> day.durationSeconds() > 0).count();
        long calendarDays = ChronoUnit.DAYS.between(from, to) + 1;
        return new StudyStatistics(from, to, total, calendarDays == 0 ? 0 : total / calendarDays,
                studyDays, sessions.size(), dayStats);
    }

    private void splitSession(
            StudySession session, LocalDate from, LocalDate to, Instant now, Map<LocalDate, MutableDayStat> days) {
        ZoneId zone = ZoneId.of(session.timezone());
        Instant sessionEnd = session.endedAt() == null ? now : session.endedAt();
        Instant clippedStart = session.startedAt().isAfter(from.atStartOfDay(zone).toInstant())
                ? session.startedAt() : from.atStartOfDay(zone).toInstant();
        Instant rangeEnd = to.plusDays(1).atStartOfDay(zone).toInstant();
        Instant clippedEnd = sessionEnd.isBefore(rangeEnd) ? sessionEnd : rangeEnd;
        if (!clippedStart.isBefore(clippedEnd)) return;
        ZonedDateTime cursor = clippedStart.atZone(zone);
        while (cursor.toInstant().isBefore(clippedEnd)) {
            LocalDate date = cursor.toLocalDate();
            ZonedDateTime nextMidnight = date.plusDays(1).atStartOfDay(zone);
            Instant segmentEnd = nextMidnight.toInstant().isBefore(clippedEnd) ? nextMidnight.toInstant() : clippedEnd;
            MutableDayStat day = days.get(date);
            if (day != null) {
                day.seconds += Duration.between(cursor.toInstant(), segmentEnd).getSeconds();
                day.sessionCount++;
            }
            cursor = segmentEnd.atZone(zone);
        }
    }

    private StudyCommand command(
            String content, String category, Instant startedAt, Instant endedAt, ZoneId timezone, String location) {
        if (startedAt == null || timezone == null) throw new IllegalArgumentException("学习时间与时区不能为空");
        StudyCommand command = new StudyCommand(startedAt.atZone(timezone).toLocalDate(), cleanContent(content),
                cleanCategory(category), startedAt, endedAt, timezone, cleanLocation(location));
        // 复用类型处理器的规则，实际写入时会再次校验并保持 seam 一致。
        if (endedAt != null && !startedAt.isBefore(endedAt)) {
            throw new IllegalArgumentException("学习结束时间必须晚于开始时间");
        }
        return command;
    }

    private StudySession requireSession(String ownerId, String eventId, Instant now) {
        if (eventId == null || eventId.isBlank()) throw new IllegalArgumentException("学习记录 ID 不能为空");
        return studyRepository.findById(ownerId, eventId, now)
                .orElseThrow(() -> new IllegalArgumentException("学习记录不存在"));
    }

    private void validateRange(String ownerId, LocalDate from, LocalDate to, ZoneId timezone) {
        validateOwner(ownerId);
        if (from == null || to == null || from.isAfter(to)) throw new IllegalArgumentException("日期范围不合法");
        if (timezone == null) throw new IllegalArgumentException("查询时区不能为空");
        if (from.plusYears(2).isBefore(to)) throw new IllegalArgumentException("单次最多查询两年学习记录");
    }

    private void validateOwner(String ownerId) {
        if (ownerId == null || ownerId.isBlank()) throw new IllegalArgumentException("用户不能为空");
    }

    private void validateCompletedTime(Instant endedAt, Instant now) {
        if (endedAt == null) throw new IllegalArgumentException("学习结束时间不能为空");
        if (endedAt.isAfter(now)) throw new IllegalArgumentException("学习结束时间不能晚于当前时间");
    }

    private void publishChanged(String ownerId, String sessionId, ChangeType changeType) {
        eventPublisher.publishEvent(new StudySessionChangedEvent(ownerId, sessionId, changeType));
    }

    private String cleanContent(String content) {
        String value = content == null ? "" : content.trim();
        if (value.isBlank()) throw new IllegalArgumentException("学习内容不能为空");
        if (value.length() > 200) throw new IllegalArgumentException("学习内容不能超过 200 个字符");
        return value;
    }

    /** 地点为可选文本，只保存用户明确填写的信息。 */
    private String cleanLocation(String location) {
        String value = location == null ? "" : location.trim();
        if (value.length() > 200) throw new IllegalArgumentException("学习地点不能超过 200 个字符");
        return value.isEmpty() ? null : value;
    }

    private String cleanCategory(String category) {
        String value = category == null || category.isBlank() ? "其他" : category.trim();
        if (value.length() > 40) throw new IllegalArgumentException("学习分类不能超过 40 个字符");
        return value;
    }

    private static final class MutableDayStat {
        private long seconds;
        private int sessionCount;
    }
}
