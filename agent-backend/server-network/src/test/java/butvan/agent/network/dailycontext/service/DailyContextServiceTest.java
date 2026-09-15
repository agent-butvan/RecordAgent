package butvan.agent.network.dailycontext.service;

import butvan.agent.network.dailycontext.config.DailyContextConfigData;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.HolidayResponse;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.WeatherResponse;
import butvan.agent.agents.config.LocalConfigService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/** 每日上下文聚合测试：验证按需请求与供应商故障隔离。 */
class DailyContextServiceTest {

    @Test
    void getSummary_keepsHolidayWhenWeatherFails() {
        DailyContextConfigData config = new DailyContextConfigData();
        DailyContextConfigService configService = new FixedConfigService(config);
        StubWeatherClient weatherClient = new StubWeatherClient(true);
        LocalDate date = LocalDate.of(2026, 10, 1);
        HolidayResponse holiday = new HolidayResponse("国庆节", "节假日", 1, true, 3, "八月廿一", "");
        StubHolidayClient holidayClient = new StubHolidayClient(holiday);

        var result = new DailyContextService(configService, weatherClient, holidayClient)
                .getSummary(date, true, true);

        assertNull(result.weather());
        assertEquals("天气失败", result.weatherError());
        assertEquals(holiday, result.holiday());
        assertNull(result.holidayError());
    }

    @Test
    void getSummary_doesNotCallDisabledProviders() {
        DailyContextConfigData config = new DailyContextConfigData();
        DailyContextConfigService configService = new FixedConfigService(config);
        StubWeatherClient weatherClient = new StubWeatherClient(false);
        StubHolidayClient holidayClient = new StubHolidayClient(null);

        var result = new DailyContextService(configService, weatherClient, holidayClient)
                .getSummary(LocalDate.of(2026, 9, 15), false, false);

        assertNull(result.weather());
        assertNull(result.holiday());
        assertEquals(0, weatherClient.calls);
        assertEquals(0, holidayClient.calls);
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
    }

    private static final class StubHolidayClient extends TianApiHolidayClient {
        private final HolidayResponse response;
        private int calls;

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
