package butvan.agent.network.daily.service;

import butvan.agent.network.daily.model.DailyEventModels.DailyDay;
import butvan.agent.network.daily.model.DailyEventModels.DailyDaySummary;
import butvan.agent.network.daily.model.DailyEventModels.DailyEventCommand;
import butvan.agent.network.daily.model.DailyEventModels.DailyEvent;
import butvan.agent.network.daily.repository.DailyEventRepository;
import butvan.agent.network.daily.repository.DailyEventRepository.DailyEventRow;
import butvan.agent.network.daily.type.DailyEventTypeRegistry;
import butvan.agent.network.daily.type.TodoTypeHandler;
import butvan.agent.network.daily.model.DailyEventModels.JournalCommand;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/** 日记录公开领域接口，隐藏 SQLite 与类型详情的持久化过程。 */
@Service
@RequiredArgsConstructor
public class DailyEventService {

    private final DailyEventRepository repository;
    private final DailyEventTypeRegistry typeRegistry;
    private final TodoTypeHandler todoTypeHandler;

    /** 创建任意已注册类型的日记录。 */
    @Transactional
    public DailyEvent create(String ownerId, DailyEventCommand command) {
        validate(ownerId, command);
        String id = UUID.randomUUID().toString();
        Instant now = Instant.now();
        String title = command.title() == null || command.title().isBlank() ? "无标题记录" : command.title().trim();
        repository.insertEvent(id, ownerId, command.eventDate(), command.eventType(), title, now);
        typeRegistry.insert(id, command);
        return getDay(ownerId, command.eventDate()).events().stream()
                .filter(event -> event.id().equals(id))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("待办创建后无法读取"));
    }

    /** 查询某一天的全部日记录。 */
    @Transactional(readOnly = true)
    public DailyDay getDay(String ownerId, LocalDate date) {
        if (ownerId == null || ownerId.isBlank() || date == null) {
            throw new IllegalArgumentException("用户与日期不能为空");
        }
        List<DailyEventRow> rows = repository.findDay(ownerId, date);
        Map<String, List<String>> idsByType = rows.stream().collect(Collectors.groupingBy(
                DailyEventRow::eventType,
                Collectors.mapping(DailyEventRow::id, Collectors.toList())));
        Map<String, Object> detailsById = typeRegistry.loadDetails(idsByType);
        List<DailyEvent> events = rows.stream().map(row -> new DailyEvent(
                row.id(), row.eventDate(), row.eventType(), row.title(), row.source(), row.status(),
                row.version(), row.createdAt(), row.updatedAt(), detailsById.get(row.id()))).toList();
        return new DailyDay(date, events);
    }

    /** 查询日期范围摘要。 */
    @Transactional(readOnly = true)
    public List<DailyDaySummary> getDays(String ownerId, LocalDate from, LocalDate to) {
        if (ownerId == null || ownerId.isBlank()) throw new IllegalArgumentException("用户不能为空");
        if (from == null || to == null || from.isAfter(to)) throw new IllegalArgumentException("日期范围不合法");
        return repository.findDaySummaries(ownerId, from, to);
    }

    /** 使用乐观版本检查修改待办完成状态。 */
    @Transactional
    public DailyEvent setTodoCompleted(String ownerId, String eventId, boolean completed, int expectedVersion) {
        DailyEventRow row = requireEvent(ownerId, eventId);
        if (!"todo".equals(row.eventType())) throw new IllegalArgumentException("指定日记录不是待办");
        todoTypeHandler.setCompleted(eventId, completed);
        if (!repository.advanceVersion(ownerId, eventId, expectedVersion, Instant.now())) {
            throw new IllegalStateException("日记录已被其他操作修改，请刷新后重试");
        }
        return getDay(ownerId, row.eventDate()).events().stream()
                .filter(event -> event.id().equals(eventId))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("待办修改后无法读取"));
    }

    /** 使用乐观版本检查删除日记录。 */
    @Transactional
    public void delete(String ownerId, String eventId, int expectedVersion) {
        requireEvent(ownerId, eventId);
        if (!repository.delete(ownerId, eventId, expectedVersion)) {
            throw new IllegalStateException("日记录已被其他操作修改，请刷新后重试");
        }
    }

    /** 更新现有手记，避免编辑操作产生重复记录。 */
    @Transactional
    public DailyEvent updateJournal(
            String ownerId, String eventId, int expectedVersion, JournalCommand command) {
        return update(ownerId, eventId, expectedVersion, command);
    }

    /** 通过类型处理器更新任意已注册日记录。 */
    @Transactional
    public DailyEvent update(
            String ownerId, String eventId, int expectedVersion, DailyEventCommand command) {
        validate(ownerId, command);
        DailyEventRow row = requireEvent(ownerId, eventId);
        if (!row.eventType().equals(command.eventType())) throw new IllegalArgumentException("日记录类型不能变更");
        typeRegistry.update(eventId, command);
        String title = command.title() == null || command.title().isBlank() ? "无标题记录" : command.title().trim();
        if (!repository.updateEvent(ownerId, eventId, expectedVersion, command.eventDate(), title, Instant.now())) {
            throw new IllegalStateException("日记录已被其他操作修改，请刷新后重试");
        }
        return getDay(ownerId, command.eventDate()).events().stream()
                .filter(event -> event.id().equals(eventId))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("手记修改后无法读取"));
    }

    private DailyEventRow requireEvent(String ownerId, String eventId) {
        if (ownerId == null || ownerId.isBlank() || eventId == null || eventId.isBlank()) {
            throw new IllegalArgumentException("用户与日记录 ID 不能为空");
        }
        return repository.findById(ownerId, eventId)
                .orElseThrow(() -> new IllegalArgumentException("日记录不存在"));
    }

    private void validate(String ownerId, DailyEventCommand command) {
        if (ownerId == null || ownerId.isBlank()) {
            throw new IllegalArgumentException("用户不能为空");
        }
        if (command == null || command.eventDate() == null) throw new IllegalArgumentException("日记录日期不能为空");
    }
}
