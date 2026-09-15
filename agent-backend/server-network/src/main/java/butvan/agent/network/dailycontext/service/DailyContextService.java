package butvan.agent.network.dailycontext.service;

import butvan.agent.network.dailycontext.config.DailyContextConfigData;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.HolidayResponse;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.LocationResponse;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.SummaryResponse;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.WeatherResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Objects;

/**
 * 聚合天气与节假日上下文。
 *
 * <p>天气使用文件持久化缓存（20 分钟 TTL），进程重启后只要未过期就不会重复请求。
 * 节假日使用文件持久化缓存（每天只请求一次）并附带每日请求限额保护（默认 90 次/天）。</p>
 */
@Service
@RequiredArgsConstructor
public class DailyContextService {

    private final DailyContextConfigService configService;
    private final QWeatherClient qWeatherClient;
    private final TianApiHolidayClient holidayClient;
    private final DailyContextStore store;

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
        store.clearWeatherCache();
        store.clearHolidayCache();
    }

    /** 使用设备坐标反查地点名称，不修改配置，用户确认保存后才持久化。 */
    public LocationResponse resolveLocation(double latitude, double longitude) {
        validateCoordinates(latitude, longitude);
        DailyContextConfigData config = configService.loadConfig();
        return qWeatherClient.lookupLocation(latitude, longitude, config.getQweather());
    }

    private static void validateCoordinates(double latitude, double longitude) {
        if (!Double.isFinite(latitude) || latitude < -90 || latitude > 90) {
            throw new IllegalArgumentException("纬度必须位于 -90 至 90 之间");
        }
        if (!Double.isFinite(longitude) || longitude < -180 || longitude > 180) {
            throw new IllegalArgumentException("经度必须位于 -180 至 180 之间");
        }
    }

    /**
     * 获取天气信息：持久化缓存优先（20 分钟 TTL）→ API 请求 → 写回持久化。
     */
    private WeatherResponse currentWeather(DailyContextConfigData config) {
        String configKey = weatherConfigKey(config);

        // 1. 持久化缓存命中且未过期则直接返回
        WeatherResponse cached = store.loadCachedWeather(configKey);
        if (cached != null) return cached;

        // 2. 请求和风天气 API
        WeatherResponse loaded = qWeatherClient.fetchCurrent(config.getQweather());

        // 3. 持久化缓存
        store.saveCachedWeather(configKey, loaded);
        return loaded;
    }

    /**
     * 获取节假日信息：持久化缓存优先 → 限额检查 → API 请求 → 写回持久化。
     */
    private HolidayResponse currentHoliday(LocalDate date, DailyContextConfigData config) {
        // 1. 持久化缓存命中则直接返回
        HolidayResponse cached = store.loadCachedHoliday(date);
        if (cached != null) return cached;

        // 2. 检查并递增每日请求计数
        store.incrementAndCheckUsage(date, DailyContextStore.DEFAULT_DAILY_LIMIT);

        // 3. 请求天行 API
        HolidayResponse loaded = holidayClient.fetch(date, config.getTianApi());

        // 4. 持久化缓存
        store.saveCachedHoliday(date, loaded);
        return loaded;
    }

    /** 由配置关键字段组成的指纹，配置变化时自动失效。 */
    private static String weatherConfigKey(DailyContextConfigData config) {
        return "%s:%s:%s:%s".formatted(
                config.getQweather().getApiHost(),
                config.getQweather().getLatitude(),
                config.getQweather().getLongitude(),
                Objects.hashCode(config.getQweather().getApiKey()));
    }
}
