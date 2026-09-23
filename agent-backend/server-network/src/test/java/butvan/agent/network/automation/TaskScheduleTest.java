package butvan.agent.network.automation;

import butvan.agent.network.automation.model.TaskSpec;
import butvan.agent.network.automation.service.TaskSchedule;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;

/** 无真实等待验证时区、夏令时和重复小时只执行一次。 */
class TaskScheduleTest {
    private TaskSpec daily(String time) {
        return new TaskSpec("提醒", "内容", "REMINDER", "DAILY", "America/New_York",
                time, null, 127, 45, 5, "00:00", "00:00", true, false, false, true,
                false, false, false);
    }
    @Test void nonexistentSpringTimeIsSkipped() {
        var next = TaskSchedule.next(daily("02:30"), Instant.parse("2026-03-08T00:00:00Z"));
        assertEquals(Instant.parse("2026-03-09T06:30:00Z").toEpochMilli(), next);
    }
    @Test void crossMidnightBelongsToPreviousWeekday() {
        var spec = new TaskSpec("提醒", "内容", "REMINDER", "DAILY", "UTC", "01:00", null,
                1 << 0, 45, 5, "22:00", "06:00", true, false, false, true, false, false, false);
        assertTrue(spec.activeAt(Instant.parse("2026-09-22T01:00:00Z"))); // 周二凌晨属于周一
        assertFalse(spec.activeAt(Instant.parse("2026-09-23T01:00:00Z")));
    }
    @Test void repeatedAutumnTimeRunsOnce() {
        var first = TaskSchedule.next(daily("01:30"), Instant.parse("2026-11-01T00:00:00Z"));
        assertEquals(Instant.parse("2026-11-01T05:30:00Z").toEpochMilli(), first);
        var after = TaskSchedule.next(daily("01:30"), Instant.ofEpochMilli(first));
        assertEquals(Instant.parse("2026-11-02T06:30:00Z").toEpochMilli(), after);
    }
}
