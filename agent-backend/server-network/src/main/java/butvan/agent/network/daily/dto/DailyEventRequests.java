package butvan.agent.network.daily.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/** 日记录写入接口的独立请求 DTO。 */
public final class DailyEventRequests {

    private DailyEventRequests() {
    }

    /** 创建待办请求。 */
    public record CreateTodoRequest(LocalDate eventDate, String title, String time, String priority, String recurrence) {
    }

    /** 创建日程请求。 */
    public record CreateScheduleRequest(
            LocalDate eventDate, String title, String startTime, String endTime, String location, String timezone) {
    }

    /** 创建花销请求。 */
    public record CreateExpenseRequest(
            LocalDate eventDate, String category, String note, BigDecimal amount, String time, String currency) {
    }

    /** 创建手记请求。 */
    public record CreateJournalRequest(LocalDate eventDate, String title, String body, String mood) {
    }

    /** 修改待办完成状态请求。 */
    public record TodoCompletionRequest(boolean completed, int expectedVersion, LocalDate occurrenceDate) {
    }
}
