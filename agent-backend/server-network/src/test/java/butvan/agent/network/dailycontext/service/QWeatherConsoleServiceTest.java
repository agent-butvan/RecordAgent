package butvan.agent.network.dailycontext.service;

import butvan.agent.agents.config.LocalConfigService;
import butvan.agent.network.dailycontext.config.DailyContextConfigData;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.QWeatherApiUsageResponse;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.QWeatherFinanceResponse;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.QWeatherUsageResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

/** 和风控制台聚合测试：验证独立降级、缓存与手动刷新语义。 */
class QWeatherConsoleServiceTest {

    @Test
    void getSummary_keepsUsageWhenFinancePermissionIsMissing() {
        StubConsoleClient client = new StubConsoleClient(true);
        QWeatherConsoleService service = new QWeatherConsoleService(fixedConfig(), client);

        var result = service.getSummary(false);

        assertNull(result.finance());
        assertEquals("缺少财务权限", result.financeError());
        assertNotNull(result.usage());
        assertNull(result.usageError());
    }

    @Test
    void getSummary_usesCacheUnlessRefreshIsRequested() {
        StubConsoleClient client = new StubConsoleClient(false);
        QWeatherConsoleService service = new QWeatherConsoleService(fixedConfig(), client);

        service.getSummary(false);
        service.getSummary(false);
        service.getSummary(true);

        assertEquals(2, client.financeCalls);
        assertEquals(2, client.usageCalls);
    }

    private static DailyContextConfigService fixedConfig() {
        DailyContextConfigData config = new DailyContextConfigData();
        config.getQweather().setApiHost("example.qweatherapi.com");
        config.getQweather().setApiKey("secret");
        return new DailyContextConfigService(new LocalConfigService(), new ObjectMapper()) {
            @Override
            DailyContextConfigData loadConfig() {
                return config;
            }
        };
    }

    private static final class StubConsoleClient extends QWeatherConsoleClient {
        private final boolean failFinance;
        private int financeCalls;
        private int usageCalls;

        private StubConsoleClient(boolean failFinance) {
            super(RestClient.builder());
            this.failFinance = failFinance;
        }

        @Override
        public QWeatherFinanceResponse fetchFinance(DailyContextConfigData.QWeatherConfig config) {
            financeCalls++;
            if (failFinance) throw new IllegalStateException("缺少财务权限");
            return new QWeatherFinanceResponse(
                    Instant.parse("2026-09-15T07:59:00Z"), "CNY",
                    BigDecimal.TEN, BigDecimal.ZERO, BigDecimal.ZERO,
                    BigDecimal.ZERO, 0, BigDecimal.ZERO);
        }

        @Override
        public QWeatherUsageResponse fetchUsage(DailyContextConfigData.QWeatherConfig config) {
            usageCalls++;
            return new QWeatherUsageResponse(
                    Instant.parse("2026-09-15T07:59:00Z"), 3, 0,
                    List.of(new QWeatherApiUsageResponse("Weather", 3, 0)));
        }
    }
}
