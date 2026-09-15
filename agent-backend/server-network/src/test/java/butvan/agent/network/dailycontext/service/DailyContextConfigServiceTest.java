package butvan.agent.network.dailycontext.service;

import butvan.agent.agents.config.LocalConfigService;
import butvan.agent.network.dailycontext.config.DailyContextConfigData;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.UpdateConfigRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 外部日信息配置测试：覆盖密钥脱敏、保留语义及请求目标约束。 */
class DailyContextConfigServiceTest {
    private final FakeConfigService storage = new FakeConfigService();
    private final DailyContextConfigService service = new DailyContextConfigService(storage, new ObjectMapper());

    @Test
    void update_persistsSecretsButOnlyReturnsConfiguredFlags() {
        var response = service.update(new UpdateConfigRequest(
                "https://abc123.xy.qweatherapi.com/", "weather-secret", false,
                "上海", 31.23, 121.47, "holiday-secret", false));

        assertEquals("abc123.xy.qweatherapi.com", response.qweatherApiHost());
        assertTrue(response.qweatherApiKeyConfigured());
        assertTrue(response.tianApiKeyConfigured());
        DailyContextConfigData saved = new ObjectMapper().convertValue(
                storage.data.getExtraFields().get("dailyContext"), DailyContextConfigData.class);
        assertEquals("weather-secret", saved.getQweather().getApiKey());
        assertEquals("holiday-secret", saved.getTianApi().getApiKey());
    }

    @Test
    void update_withBlankSecretsPreservesStoredValues() {
        service.update(new UpdateConfigRequest(
                "abc123.xy.qweatherapi.com", "weather-secret", false,
                "上海", 31.23, 121.47, "holiday-secret", false));
        service.update(new UpdateConfigRequest(
                "abc123.xy.qweatherapi.com", "", false,
                "杭州", 30.27, 120.15, "", false));

        DailyContextConfigData saved = service.loadConfig();
        assertEquals("weather-secret", saved.getQweather().getApiKey());
        assertEquals("holiday-secret", saved.getTianApi().getApiKey());
        assertEquals("杭州", saved.getQweather().getLocationName());
    }

    @Test
    void update_rejectsArbitraryHostsAndInvalidCoordinates() {
        assertThrows(IllegalArgumentException.class, () -> service.update(new UpdateConfigRequest(
                "localhost", "secret", false, "本机", 31.0, 121.0, "", false)));
        assertThrows(IllegalArgumentException.class, () -> service.update(new UpdateConfigRequest(
                "abc.xy.qweatherapi.com", "secret", false, "错误地点", 91.0, 121.0, "", false)));
    }

    /** 内存配置存储，测试期间不触碰用户真实 config.json。 */
    private static final class FakeConfigService extends LocalConfigService {
        private ModelConfigData data = new ModelConfigData();

        @Override
        public ModelConfigData loadFullConfigData() {
            return data;
        }

        @Override
        public synchronized void saveFullConfigData(ModelConfigData fullData) {
            data = fullData;
        }
    }
}
