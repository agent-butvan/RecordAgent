package butvan.agent.network.dailycontext.service;

import butvan.agent.agents.storage.AgentStorageProperties;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.HolidayResponse;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;

/**
 * 天行 API 节假日结果与每日请求计数的本地持久化存储。
 *
 * <p>节假日数据每天不变，首次成功请求后写入文件，当天后续请求直接读文件；
 * 每日请求计数单独持久化，进程重启后不会丢失，保证不超出第三方免费额度。</p>
 */
@Slf4j
@Component
public class TianApiHolidayStore {

    /** 每日请求硬限制。 */
    static final int DEFAULT_DAILY_LIMIT = 90;

    private static final String HOLIDAY_CACHE_FILE = "holiday-cache.json";
    private static final String USAGE_FILE = "tianapi-usage.json";

    private final Path holidayCachePath;
    private final Path usagePath;
    private final ObjectMapper objectMapper;

    public TianApiHolidayStore(AgentStorageProperties storageProperties, ObjectMapper objectMapper) {
        this.holidayCachePath = storageProperties.getDailyContextDirectory().resolve(HOLIDAY_CACHE_FILE);
        this.usagePath = storageProperties.getDailyContextDirectory().resolve(USAGE_FILE);
        this.objectMapper = objectMapper;
    }

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
     * 递增当日请求计数并检查是否超限。
     *
     * @param date 当前日期
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

    /** 节假日结果的持久化格式。 */
    record HolidayCacheEntry(
            @JsonProperty("date") String date,
            @JsonProperty("holiday") HolidayResponse holiday
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
