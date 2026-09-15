package butvan.agent.network.dailycontext.service;

import butvan.agent.network.dailycontext.config.DailyContextConfigData;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.HolidayResponse;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.SummaryResponse;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.WeatherResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;

/** 聚合天气与节假日上下文，并用短期内存缓存保护第三方免费额度。 */
@Service
@RequiredArgsConstructor
public class DailyContextService {
    private static final Duration WEATHER_TTL = Duration.ofMinutes(20);
    private static final Duration HOLIDAY_TTL = Duration.ofHours(12);

    private final DailyContextConfigService configService;
    private final QWeatherClient qWeatherClient;
    private final TianApiHolidayClient holidayClient;
    private volatile CacheEntry<WeatherResponse> weatherCache;
    private volatile CacheEntry<HolidayResponse> holidayCache;

    /** 查询当日上下文；两个供应商独立降级，任一失败仍返回另一项。 */
    public SummaryResponse getSummary(LocalDate date, boolean includeWeather, boolean includeHoliday) {
        DailyContextConfigData config = configService.loadConfig();
        WeatherResponse weather = null;
        HolidayResponse holiday = null;
        String weatherError = null;
        String holidayError = null;
        if (includeWeather) {
            try {
                weather = currentWeather(config);
            } catch (RuntimeException exception) {
                weatherError = exception.getMessage();
            }
        }
        if (includeHoliday) {
            try {
                holiday = currentHoliday(date, config);
            } catch (RuntimeException exception) {
                holidayError = exception.getMessage();
            }
        }
        return new SummaryResponse(date, weather, holiday, weatherError, holidayError);
    }

    /** 配置变化后清空供应商缓存，保证连接测试和新配置立即生效。 */
    public void clearCaches() {
        weatherCache = null;
        holidayCache = null;
    }

    private WeatherResponse currentWeather(DailyContextConfigData config) {
        String key = "%s:%s:%s:%s".formatted(config.getQweather().getApiHost(),
                config.getQweather().getLatitude(), config.getQweather().getLongitude(),
                Objects.hashCode(config.getQweather().getApiKey()));
        CacheEntry<WeatherResponse> cached = weatherCache;
        if (cached != null && cached.usable(key)) return cached.value();
        WeatherResponse loaded = qWeatherClient.fetchCurrent(config.getQweather());
        weatherCache = new CacheEntry<>(key, loaded, Instant.now().plus(WEATHER_TTL));
        return loaded;
    }

    private HolidayResponse currentHoliday(LocalDate date, DailyContextConfigData config) {
        String key = date + ":" + Objects.hashCode(config.getTianApi().getApiKey());
        CacheEntry<HolidayResponse> cached = holidayCache;
        if (cached != null && cached.usable(key)) return cached.value();
        HolidayResponse loaded = holidayClient.fetch(date, config.getTianApi());
        holidayCache = new CacheEntry<>(key, loaded, Instant.now().plus(HOLIDAY_TTL));
        return loaded;
    }

    private record CacheEntry<T>(String key, T value, Instant expiresAt) {
        private boolean usable(String expectedKey) {
            return key.equals(expectedKey) && Instant.now().isBefore(expiresAt);
        }
    }
}
