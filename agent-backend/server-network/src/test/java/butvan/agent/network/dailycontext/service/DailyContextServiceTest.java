package butvan.agent.network.dailycontext.service;

import butvan.agent.network.dailycontext.config.DailyContextConfigData;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.HolidayResponse;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.LocationResponse;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.SummaryResponse;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.WeatherResponse;
import butvan.agent.agents.config.LocalConfigService;
import butvan.agent.agents.storage.AgentStorageProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.web.client.RestClient;

import java.nio.file.Path;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** 每日上下文聚合测试：验证按需请求、供应商故障隔离与持久化缓存。 */
class DailyContextServiceTest {

    @TempDir
    Path tempDir;

    private DailyContextService createService(
            StubWeatherClient weatherClient,
            StubHolidayClient holidayClient
    ) {
        return createService(weatherClient, holidayClient, new DailyContextConfigData());
    }

    private DailyContextService createService(
            StubWeatherClient weatherClient,
            StubHolidayClient holidayClient,
            DailyContextConfigData config
    ) {
        DailyContextConfigService configService = new FixedConfigService(config);
        AgentStorageProperties storageProperties = new AgentStorageProperties(tempDir);
        TianApiHolidayStore holidayStore = new TianApiHolidayStore(storageProperties, new ObjectMapper());
        return new DailyContextService(configService, weatherClient, holidayClient, holidayStore);
    }

    @Test
    void getSummary_keepsHolidayWhenWeatherFails() {
        StubWeatherClient weatherClient = new StubWeatherClient(true);
        LocalDate date = LocalDate.of(2026, 10, 1);
        HolidayResponse holiday = new HolidayResponse("国庆节", "节假日", 1, true, 3, "八月廿一", "");
        StubHolidayClient holidayClient = new StubHolidayClient(holiday);

        var result = createService(weatherClient, holidayClient)
                .getSummary(date, true, true);

        assertNull(result.weather());
        assertEquals("天气失败", result.weatherError());
        assertEquals(holiday, result.holiday());
        assertNull(result.holidayError());
    }

    @Test
    void getSummary_doesNotCallDisabledProviders() {
        StubWeatherClient weatherClient = new StubWeatherClient(false);
        StubHolidayClient holidayClient = new StubHolidayClient(null);

        var result = createService(weatherClient, holidayClient)
                .getSummary(LocalDate.of(2026, 9, 15), false, false);

        assertNull(result.weather());
        assertNull(result.holiday());
        assertEquals(0, weatherClient.calls);
        assertEquals(0, holidayClient.calls);
    }

    @Test
    void resolveLocation_rejectsCoordinatesOutsideEarthBounds() {
        StubWeatherClient weatherClient = new StubWeatherClient(false);
        DailyContextService service = createService(weatherClient, new StubHolidayClient(null));

        assertThrows(IllegalArgumentException.class, () -> service.resolveLocation(91, 117));
        assertEquals(0, weatherClient.locationCalls);
    }

    @Test
    void getSummary_usesPersistedCacheAndDoesNotCallApiTwice() {
        LocalDate date = LocalDate.of(2026, 10, 1);
        HolidayResponse holiday = new HolidayResponse("国庆节", "节假日", 1, true, 3, "八月廿一", "");
        StubHolidayClient holidayClient = new StubHolidayClient(holiday);
        DailyContextService service = createService(new StubWeatherClient(false), holidayClient);

        // 首次请求应调用 API
        SummaryResponse first = service.getSummary(date, false, true);
        assertNotNull(first.holiday());
        assertEquals(1, holidayClient.calls);

        // 第二次请求应命中持久化缓存
        SummaryResponse second = service.getSummary(date, false, true);
        assertNotNull(second.holiday());
        assertEquals("国庆节", second.holiday().name());
        assertEquals(1, holidayClient.calls); // 未再次调用
    }

    @Test
    void getSummary_refetchesForDifferentDate() {
        LocalDate oct1 = LocalDate.of(2026, 10, 1);
        LocalDate oct2 = LocalDate.of(2026, 10, 2);
        HolidayResponse holiday1 = new HolidayResponse("国庆节", "节假日", 1, true, 3, "八月廿一", "");
        HolidayResponse holiday2 = new HolidayResponse("国庆节", "节假日", 1, true, 3, "八月廿二", "");
        StubHolidayClient holidayClient = new StubHolidayClient(holiday1);
        DailyContextService service = createService(new StubWeatherClient(false), holidayClient);

        service.getSummary(oct1, false, true);
        assertEquals(1, holidayClient.calls);

        // 切换日期后应重新请求
        holidayClient.response = holiday2;
        service.getSummary(oct2, false, true);
        assertEquals(2, holidayClient.calls);
    }

    @Test
    void getSummary_rejectsWhenDailyLimitExceeded() {
        LocalDate date = LocalDate.of(2026, 9, 15);
        // 用一个总是失败的 holiday client，模拟持续消耗限额但未成功缓存
        StubHolidayClient failingClient = new StubHolidayClient(null) {
            @Override
            public HolidayResponse fetch(LocalDate d, DailyContextConfigData.TianApiConfig config) {
                calls++;
                throw new IllegalStateException("模拟API失败");
            }
        };

        DailyContextConfigData config = new DailyContextConfigData();
        DailyContextConfigService configService = new FixedConfigService(config);
        AgentStorageProperties storageProperties = new AgentStorageProperties(tempDir);
        TianApiHolidayStore store = new TianApiHolidayStore(storageProperties, new ObjectMapper());
        DailyContextService service = new DailyContextService(configService,
                new StubWeatherClient(false), failingClient, store);

        // 先用尽限额（使用较小限额方便测试）——直接操作 store
        for (int i = 0; i < TianApiHolidayStore.DEFAULT_DAILY_LIMIT; i++) {
            store.incrementAndCheckUsage(date, TianApiHolidayStore.DEFAULT_DAILY_LIMIT);
        }

        // 下一次请求应因限额而失败
        SummaryResponse result = service.getSummary(date, false, true);
        assertNotNull(result.holidayError());
        assertEquals(true, result.holidayError().contains("上限"));
    }

    private static final class FixedConfigService extends DailyContextConfigService {
        private final DailyContextConfigData config;

        private FixedConfigService(DailyContextConfigData config) {
            super(new LocalConfigService(), new ObjectMapper());
            this.config = config;
        }

        @Override
        DailyContextConfigData loadConfig() {
            return config;
        }
    }

    private static final class StubWeatherClient extends QWeatherClient {
        private final boolean fail;
        private int calls;
        private int locationCalls;

        private StubWeatherClient(boolean fail) {
            super(RestClient.builder());
            this.fail = fail;
        }

        @Override
        public WeatherResponse fetchCurrent(DailyContextConfigData.QWeatherConfig config) {
            calls++;
            if (fail) throw new IllegalStateException("天气失败");
            return null;
        }

        @Override
        public LocationResponse lookupLocation(
                double latitude,
                double longitude,
                DailyContextConfigData.QWeatherConfig config
        ) {
            locationCalls++;
            return null;
        }
    }

    private static class StubHolidayClient extends TianApiHolidayClient {
        HolidayResponse response;
        int calls;

        private StubHolidayClient(HolidayResponse response) {
            super(RestClient.builder());
            this.response = response;
        }

        @Override
        public HolidayResponse fetch(LocalDate date, DailyContextConfigData.TianApiConfig config) {
            calls++;
            return response;
        }
    }
}
