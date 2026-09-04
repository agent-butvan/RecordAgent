package butvan.agent.network.record.model;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** 记录领域内部模型。 */
public final class RecordModels {
    private RecordModels() {
    }

    /** 系统内置的五种记录类型。 */
    public enum RecordType {
        QUICK("quick"), LEARNING("learning"), WEEKLY_REVIEW("weekly_review"),
        READING("reading"), JOURNAL("journal");

        private final String value;

        RecordType(String value) { this.value = value; }
        public String value() { return value; }

        /** 将接口值转换为受控类型。 */
        public static RecordType parse(String value) {
            for (RecordType type : values()) if (type.value.equals(value)) return type;
            throw new IllegalArgumentException("不支持的记录类型");
        }
    }

    /** 创建或覆盖记录所需的完整输入。 */
    public record RecordCommand(LocalDate recordDate, RecordType type, String title,
                                String contentHtml, String contentText, List<String> tags) {
    }

    /** 一条可展示的记录。 */
    public record RecordEntry(String id, LocalDate recordDate, RecordType type, String title,
                              String contentHtml, String contentText, List<String> tags,
                              boolean pinned, boolean favorite, boolean archived, Instant trashedAt,
                              Integer weekYear, Integer weekNumber, int version,
                              Instant createdAt, Instant updatedAt) {
    }

    /** 某日轻量聚合数据。 */
    public record DaySummary(LocalDate date, int count, boolean weeklyReviewCompleted) {
    }

    /** 记录附件的元数据，文件内容由本地文件适配器保存。 */
    public record RecordAttachment(String id, String recordId, String originalName, String storedName,
                                   String mediaType, long sizeBytes, Instant createdAt) {
    }
}
