package butvan.agent.network.dailycontext.service;

import butvan.agent.agents.storage.AgentStorageProperties;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.HolidayResponse;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.WeatherResponse;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;

/**
 * 天气与节假日的本地持久化缓存与请求限额管理。
 *
 * <p>节假日数据每天不变，首次成功请求后写入文件，当天后续请求直接读文件。
 * 天气数据保留 20 分钟 TTL，过期后重新请求但结果仍持久化，进程重启后
 * 只要未过 TTL 就不会重复请求。每日请求计数单独持久化，保证不超出第三方免费额度。</p>
 */
@Slf4j
@Component
public class DailyContextStore {

    /** 天行 API 每日请求硬限制。 */
    static final int DEFAULT_DAILY_LIMIT = 90;

    /** 天气缓存有效期。 */
    static final Duration WEATHER_TTL = Duration.ofMinutes(20);

    private static final String HOLIDAY_CACHE_FILE = "holiday-cache.json";
    private static final String WEATHER_CACHE_FILE = "weather-cache.json";
    private static final String USAGE_FILE = "tianapi-usage.json";

    private final Path holidayCachePath;
    private final Path weatherCachePath;
    private final Path usagePath;
    private final ObjectMapper objectMapper;

    public DailyContextStore(AgentStorageProperties storageProperties, ObjectMapper objectMapper) {
        this.holidayCachePath = storageProperties.getDailyContextDirectory().resolve(HOLIDAY_CACHE_FILE);
        this.weatherCachePath = storageProperties.getDailyContextDirectory().resolve(WEATHER_CACHE_FILE);
        this.usagePath = storageProperties.getDailyContextDirectory().resolve(USAGE_FILE);
        this.objectMapper = objectMapper;
    }

    // ── 节假日缓存 ──────────────────────────────────────────────

    /**
     * 读取持久化的节假日缓存；日期匹配返回缓存结果，不匹配或文件不存在返回 {@code null}。
     */
    public synchronized HolidayResponse loadCachedHoliday(LocalDate date) {
        if (!Files.exists(holidayCachePath)) return null;
        try {
            HolidayCacheEntry entry = objectMapper.readValue(holidayCachePath.toFile(), HolidayCacheEntry.class);
            if (entry != null && date.toString().equals(entry.date)) {
                return entry.holiday;
            }
        } catch (IOException e) {
            log.warn("读取节假日缓存文件失败，将重新请求: {}", holidayCachePath, e);
        }
        return null;
    }

    /**
     * 将节假日结果写入持久化文件。
     */
    public synchronized void saveCachedHoliday(LocalDate date, HolidayResponse response) {
        try {
            objectMapper.writeValue(holidayCachePath.toFile(), new HolidayCacheEntry(date.toString(), response));
        } catch (IOException e) {
            log.error("保存节假日缓存文件失败: {}", holidayCachePath, e);
        }
    }

    /**
     * 清除持久化的节假日缓存文件（配置变更时调用）。
     */
    public synchronized void clearHolidayCache() {
        try {
            Files.deleteIfExists(holidayCachePath);
        } catch (IOException e) {
            log.warn("删除节假日缓存文件失败: {}", holidayCachePath, e);
        }
    }

    // ── 天气缓存 ──────────────────────────────────────────────

    /**
     * 读取持久化的天气缓存；配置 key 匹配且未过 TTL 则返回缓存结果，否则返回 {@code null}。
     *
     * @param configKey 由 API Host、经纬度和密钥 hash 组成的配置指纹
     */
    public synchronized WeatherResponse loadCachedWeather(String configKey) {
        if (!Files.exists(weatherCachePath)) return null;
        try {
            WeatherCacheEntry entry = objectMapper.readValue(weatherCachePath.toFile(), WeatherCacheEntry.class);
            if (entry != null
                    && configKey.equals(entry.configKey)
                    && entry.expiresAt != null
                    && Instant.now().isBefore(Instant.parse(entry.expiresAt))) {
                return entry.weather;
            }
        } catch (IOException e) {
            log.warn("读取天气缓存文件失败，将重新请求: {}", weatherCachePath, e);
        }
        return null;
    }

    /**
     * 将天气结果写入持久化文件，附带 TTL 过期时间。
     *
     * @param configKey 配置指纹
     * @param response  天气响应
     */
    public synchronized void saveCachedWeather(String configKey, WeatherResponse response) {
        try {
            String expiresAt = Instant.now().plus(WEATHER_TTL).toString();
            objectMapper.writeValue(weatherCachePath.toFile(),
                    new WeatherCacheEntry(configKey, response, expiresAt));
        } catch (IOException e) {
            log.error("保存天气缓存文件失败: {}", weatherCachePath, e);
        }
    }

    /**
     * 清除持久化的天气缓存文件（配置变更时调用）。
     */
    public synchronized void clearWeatherCache() {
        try {
            Files.deleteIfExists(weatherCachePath);
        } catch (IOException e) {
            log.warn("删除天气缓存文件失败: {}", weatherCachePath, e);
        }
    }

    // ── 天行 API 每日请求限额 ──────────────────────────────────

    /**
     * 递增当日请求计数并检查是否超限。
     *
     * @param date       当前日期
     * @param dailyLimit 每日请求上限
     * @throws IllegalStateException 超出每日限额时抛出
     */
    public synchronized void incrementAndCheckUsage(LocalDate date, int dailyLimit) {
        UsageEntry usage = loadUsage(date);
        if (usage.count >= dailyLimit) {
            throw new IllegalStateException(
                    "天聚数行 API 今日请求已达上限（%d 次），请明天再试。".formatted(dailyLimit));
        }
        usage.count++;
        saveUsage(usage);
    }

    private UsageEntry loadUsage(LocalDate date) {
        if (!Files.exists(usagePath)) {
            return new UsageEntry(date.toString(), 0);
        }
        try {
            UsageEntry entry = objectMapper.readValue(usagePath.toFile(), UsageEntry.class);
            if (entry != null && date.toString().equals(entry.date)) {
                return entry;
            }
        } catch (IOException e) {
            log.warn("读取天行 API 用量文件失败，按 0 次处理: {}", usagePath, e);
        }
        return new UsageEntry(date.toString(), 0);
    }

    private void saveUsage(UsageEntry usage) {
        try {
            objectMapper.writeValue(usagePath.toFile(), usage);
        } catch (IOException e) {
            log.error("保存天行 API 用量文件失败: {}", usagePath, e);
        }
    }

    // ── 持久化格式 ──────────────────────────────────────────────

    /** 节假日结果的持久化格式。 */
    record HolidayCacheEntry(
            @JsonProperty("date") String date,
            @JsonProperty("holiday") HolidayResponse holiday
    ) {}

    /** 天气结果的持久化格式。 */
    record WeatherCacheEntry(
            @JsonProperty("configKey") String configKey,
            @JsonProperty("weather") WeatherResponse weather,
            @JsonProperty("expiresAt") String expiresAt
    ) {}

    /** 每日请求计数的持久化格式。 */
    static class UsageEntry {
        @JsonProperty("date")
        String date;
        @JsonProperty("count")
        int count;

        UsageEntry() {}

        UsageEntry(String date, int count) {
            this.date = date;
            this.count = count;
        }
    }
}
