package butvan.agent.network.dailycontext.service;

import butvan.agent.agents.storage.AgentStorageProperties;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.HolidayResponse;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.WeatherResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

/** 天气与节假日持久化缓存存储单元测试。 */
class DailyContextStoreTest {

    @TempDir
    Path tempDir;

    private DailyContextStore store;

    @BeforeEach
    void setUp() {
        AgentStorageProperties storageProperties = new AgentStorageProperties(tempDir);
        store = new DailyContextStore(storageProperties, new ObjectMapper());
    }

    // ── 节假日缓存 ──────────────────────────────────────────────

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
    void clearHolidayCache_removesCachedFile() {
        LocalDate date = LocalDate.of(2026, 10, 1);
        HolidayResponse holiday = new HolidayResponse("国庆节", "节假日", 1, true, 3, "八月廿一", "");
        store.saveCachedHoliday(date, holiday);
        assertNotNull(store.loadCachedHoliday(date));

        store.clearHolidayCache();
        assertNull(store.loadCachedHoliday(date));
    }

    // ── 天气缓存 ──────────────────────────────────────────────

    @Test
    void loadCachedWeather_returnsNullWhenFileDoesNotExist() {
        assertNull(store.loadCachedWeather("key1"));
    }

    @Test
    void saveThenLoad_returnsCachedWeather() {
        String configKey = "host:30.0:120.0:12345";
        WeatherResponse weather = new WeatherResponse(
                "杭州", "晴", "100", 26.5, "°C", 27.0, 65, "东南风", 3.5, "m/s",
                "https://developer.qweather.com/attribution.html");
        store.saveCachedWeather(configKey, weather);

        WeatherResponse loaded = store.loadCachedWeather(configKey);
        assertNotNull(loaded);
        assertEquals("杭州", loaded.locationName());
        assertEquals("晴", loaded.condition());
        assertEquals(26.5, loaded.temperature());
    }

    @Test
    void loadCachedWeather_returnsNullWhenConfigKeyDoesNotMatch() {
        String configKey = "host:30.0:120.0:12345";
        WeatherResponse weather = new WeatherResponse(
                "杭州", "晴", "100", 26.5, "°C", 27.0, 65, "东南风", 3.5, "m/s",
                "https://developer.qweather.com/attribution.html");
        store.saveCachedWeather(configKey, weather);

        assertNull(store.loadCachedWeather("different-key"));
    }

    @Test
    void clearWeatherCache_removesCachedFile() {
        String configKey = "host:30.0:120.0:12345";
        WeatherResponse weather = new WeatherResponse(
                "杭州", "晴", "100", 26.5, "°C", 27.0, 65, "东南风", 3.5, "m/s",
                "https://developer.qweather.com/attribution.html");
        store.saveCachedWeather(configKey, weather);
        assertNotNull(store.loadCachedWeather(configKey));

        store.clearWeatherCache();
        assertNull(store.loadCachedWeather(configKey));
    }

    // ── 天行 API 限额 ──────────────────────────────────────────

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
}
