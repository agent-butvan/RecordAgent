package butvan.agent.network.record.service;

import butvan.agent.network.record.model.RecordModels.DaySummary;
import butvan.agent.network.record.model.RecordModels.RecordCommand;
import butvan.agent.network.record.model.RecordModels.RecordEntry;
import butvan.agent.network.record.model.RecordModels.RecordType;
import butvan.agent.network.record.repository.RecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.WeekFields;
import java.util.List;
import java.util.UUID;

/** 记录资料库的领域入口，集中维护类型、自然周、标签和乐观锁规则。 */
@Service
@RequiredArgsConstructor
public class RecordService {
    private static final int MAX_CONTENT_LENGTH = 2_000_000;
    private final RecordRepository repository;

    /** 查询记录列表。 */
    public List<RecordEntry> search(String ownerId, LocalDate from, LocalDate to,
                                    String type, String tag, String query) {
        requireRange(from, to);
        if (type != null && !type.isBlank()) RecordType.parse(type);
        return repository.search(ownerId, from, to, type, tag, query);
    }

    /** 查询日历摘要。 */
    public List<DaySummary> summarizeDays(String ownerId, LocalDate from, LocalDate to) {
        requireRange(from, to);
        return repository.summarizeDays(ownerId, from, to);
    }

    /** 查询一条记录。 */
    public RecordEntry get(String ownerId, String id) {
        return repository.find(ownerId, id).orElseThrow(() -> new IllegalArgumentException("记录不存在"));
    }

    /** 创建记录并原子写入标签。 */
    @Transactional
    public RecordEntry create(String ownerId, RecordCommand command) {
        validate(command);
        String id = UUID.randomUUID().toString();
        Instant now = Instant.now();
        WeekBinding week = weekBinding(command);
        repository.insert(id, ownerId, command.recordDate(), command.type(), cleanTitle(command.title()),
                command.contentHtml(), command.contentText(), week.year(), week.number(), now);
        repository.replaceTags(ownerId, id, normalizedTags(command.tags()), now);
        return get(ownerId, id);
    }

    /** 以版本号保护方式覆盖记录与标签。 */
    @Transactional
    public RecordEntry update(String ownerId, String id, int expectedVersion, RecordCommand command) {
        validate(command);
        WeekBinding week = weekBinding(command);
        Instant now = Instant.now();
        if (!repository.update(ownerId, id, expectedVersion, command.recordDate(), command.type(),
                cleanTitle(command.title()), command.contentHtml(), command.contentText(), week.year(), week.number(), now)) {
            throw new IllegalArgumentException("记录已被修改或不存在，请刷新后重试");
        }
        repository.replaceTags(ownerId, id, normalizedTags(command.tags()), now);
        return get(ownerId, id);
    }

    /** 修改置顶、收藏或归档状态。 */
    @Transactional
    public RecordEntry updateFlags(String ownerId, String id, int expectedVersion,
                                   Boolean pinned, Boolean favorite, Boolean archived) {
        RecordEntry current = get(ownerId, id);
        boolean nextPinned = pinned == null ? current.pinned() : pinned;
        boolean nextFavorite = favorite == null ? current.favorite() : favorite;
        boolean nextArchived = archived == null ? current.archived() : archived;
        if (!repository.updateFlags(ownerId, id, expectedVersion, nextPinned, nextFavorite, nextArchived, Instant.now())) {
            throw new IllegalArgumentException("记录已被修改，请刷新后重试");
        }
        return get(ownerId, id);
    }

    /** 将记录移入回收站。 */
    public void trash(String ownerId, String id, int expectedVersion) {
        if (!repository.setTrashed(ownerId, id, expectedVersion, Instant.now(), Instant.now())) {
            throw new IllegalArgumentException("记录已被修改或不存在，请刷新后重试");
        }
    }

    /** 从回收站恢复记录。 */
    public RecordEntry restore(String ownerId, String id, int expectedVersion) {
        if (!repository.setTrashed(ownerId, id, expectedVersion, null, Instant.now())) {
            throw new IllegalArgumentException("记录已被修改或不存在，请刷新后重试");
        }
        return get(ownerId, id);
    }

    public List<RecordEntry> trashEntries(String ownerId) { return repository.findTrash(ownerId); }
    public int clearTrash(String ownerId) { return repository.clearTrash(ownerId); }

    private void validate(RecordCommand command) {
        if (command == null || command.recordDate() == null || command.type() == null) {
            throw new IllegalArgumentException("记录日期和类型不能为空");
        }
        String html = command.contentHtml() == null ? "" : command.contentHtml();
        String text = command.contentText() == null ? "" : command.contentText();
        if (html.length() > MAX_CONTENT_LENGTH || text.length() > MAX_CONTENT_LENGTH) {
            throw new IllegalArgumentException("记录正文过长");
        }
        if ((command.title() == null || command.title().isBlank()) && text.isBlank()) {
            throw new IllegalArgumentException("标题和正文不能同时为空");
        }
        if (command.tags() != null && command.tags().size() > 30) throw new IllegalArgumentException("每条记录最多添加 30 个标签");
    }

    private void requireRange(LocalDate from, LocalDate to) {
        if (from == null || to == null || from.isAfter(to)) throw new IllegalArgumentException("日期范围不合法");
        if (from.plusYears(2).isBefore(to)) throw new IllegalArgumentException("单次查询日期范围不能超过两年");
    }

    private WeekBinding weekBinding(RecordCommand command) {
        if (command.type() != RecordType.WEEKLY_REVIEW) return new WeekBinding(null, null);
        WeekFields fields = WeekFields.ISO;
        return new WeekBinding(command.recordDate().get(fields.weekBasedYear()), command.recordDate().get(fields.weekOfWeekBasedYear()));
    }

    private String cleanTitle(String title) {
        String value = title == null ? "" : title.trim();
        if (value.length() > 200) throw new IllegalArgumentException("标题不能超过 200 个字符");
        return value.isEmpty() ? null : value;
    }

    private List<String> normalizedTags(List<String> tags) {
        return (tags == null ? List.<String>of() : tags).stream().filter(java.util.Objects::nonNull)
                .map(String::trim).filter(value -> !value.isEmpty()).distinct().peek(value -> {
                    if (value.length() > 40) throw new IllegalArgumentException("标签不能超过 40 个字符");
                }).toList();
    }

    private record WeekBinding(Integer year, Integer number) { }
}
