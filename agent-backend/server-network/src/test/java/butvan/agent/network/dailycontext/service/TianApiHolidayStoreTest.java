package butvan.agent.network.dailycontext.service;

import butvan.agent.agents.storage.AgentStorageProperties;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.HolidayResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

/** 节假日持久化存储单元测试。 */
class TianApiHolidayStoreTest {

    @TempDir
    Path tempDir;

    private TianApiHolidayStore store;

    @BeforeEach
    void setUp() {
        AgentStorageProperties storageProperties = new AgentStorageProperties(tempDir);
        store = new TianApiHolidayStore(storageProperties, new ObjectMapper());
    }

    @Test
    void loadCachedHoliday_returnsNullWhenFileDoesNotExist() {
        assertNull(store.loadCachedHoliday(LocalDate.of(2026, 9, 15)));
    }

    @Test
    void saveThenLoad_returnsCachedHoliday() {
        LocalDate date = LocalDate.of(2026, 10, 1);
        HolidayResponse holiday = new HolidayResponse("国庆节", "节假日", 1, true, 3, "八月廿一", "");
        store.saveCachedHoliday(date, holiday);

        HolidayResponse loaded = store.loadCachedHoliday(date);
        assertNotNull(loaded);
        assertEquals("国庆节", loaded.name());
        assertTrue(loaded.dayOff());
    }

    @Test
    void loadCachedHoliday_returnsNullWhenDateDoesNotMatch() {
        LocalDate oct1 = LocalDate.of(2026, 10, 1);
        HolidayResponse holiday = new HolidayResponse("国庆节", "节假日", 1, true, 3, "八月廿一", "");
        store.saveCachedHoliday(oct1, holiday);

        assertNull(store.loadCachedHoliday(LocalDate.of(2026, 10, 2)));
    }

    @Test
    void incrementAndCheckUsage_allowsWithinLimit() {
        LocalDate date = LocalDate.of(2026, 9, 15);
        assertDoesNotThrow(() -> store.incrementAndCheckUsage(date, 3));
        assertDoesNotThrow(() -> store.incrementAndCheckUsage(date, 3));
        assertDoesNotThrow(() -> store.incrementAndCheckUsage(date, 3));
    }

    @Test
    void incrementAndCheckUsage_rejectsWhenLimitReached() {
        LocalDate date = LocalDate.of(2026, 9, 15);
        store.incrementAndCheckUsage(date, 2);
        store.incrementAndCheckUsage(date, 2);

        IllegalStateException exception = assertThrows(
                IllegalStateException.class,
                () -> store.incrementAndCheckUsage(date, 2));
        assertTrue(exception.getMessage().contains("上限"));
    }

    @Test
    void incrementAndCheckUsage_resetsForNewDate() {
        LocalDate day1 = LocalDate.of(2026, 9, 15);
        store.incrementAndCheckUsage(day1, 1);
        assertThrows(IllegalStateException.class, () -> store.incrementAndCheckUsage(day1, 1));

        // 新日期应该重新计数
        LocalDate day2 = LocalDate.of(2026, 9, 16);
        assertDoesNotThrow(() -> store.incrementAndCheckUsage(day2, 1));
    }

    @Test
    void clearHolidayCache_removesCachedFile() {
        LocalDate date = LocalDate.of(2026, 10, 1);
        HolidayResponse holiday = new HolidayResponse("国庆节", "节假日", 1, true, 3, "八月廿一", "");
        store.saveCachedHoliday(date, holiday);
        assertNotNull(store.loadCachedHoliday(date));

        store.clearHolidayCache();
        assertNull(store.loadCachedHoliday(date));
    }
}
