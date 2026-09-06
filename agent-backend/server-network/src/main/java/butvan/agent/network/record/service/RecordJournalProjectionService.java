package butvan.agent.network.record.service;

import butvan.agent.network.record.model.RecordModels.RecordEntry;
import butvan.agent.network.record.model.RecordModels.RecordType;
import butvan.agent.network.record.repository.RecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;

/** 维护日历手记在资料库中的可检索投影，避免两个入口出现内容断层。 */
@Service
@RequiredArgsConstructor
public class RecordJournalProjectionService {
    private final RecordRepository repository;
    private final RecordTabService tabService;

    /** 创建或更新一条日历手记对应的资料投影。 */
    @Transactional
    public void upsertFromCalendar(String ownerId, String eventId, LocalDate date, String title, String body) {
        String cleanTitle = title == null || title.isBlank() ? null : title.trim();
        String text = body == null ? "" : body;
        String tabId = tabService.resolve(ownerId, null, RecordType.JOURNAL);
        RecordEntry existing = repository.findBySourceReference(ownerId, "calendar", eventId).orElse(null);
        if (existing == null) {
            repository.insertCalendarJournal("calendar-" + eventId, ownerId, date, cleanTitle, text,
                    tabId, eventId, Instant.now());
            return;
        }
        repository.updateCalendarJournal(ownerId, eventId, date, cleanTitle, text, tabId, Instant.now());
    }

    /** 删除日历端已经永久删除的手记投影。 */
    @Transactional
    public void removeFromCalendar(String ownerId, String eventId) {
        repository.deleteCalendarJournal(ownerId, eventId);
    }
}
