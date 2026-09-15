package butvan.agent.network.dailycontext.service;

import butvan.agent.network.dailycontext.config.DailyContextConfigData;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.QWeatherConsoleResponse;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.QWeatherFinanceResponse;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.QWeatherUsageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

/** 聚合和风控制台财务与请求量数据，并以短缓存减少无意义的重复查询。 */
@Service
@RequiredArgsConstructor
public class QWeatherConsoleService {
    private static final Duration CACHE_TTL = Duration.ofMinutes(10);

    private final DailyContextConfigService configService;
    private final QWeatherConsoleClient consoleClient;
    private volatile CacheEntry<QWeatherFinanceResponse> financeCache;
    private volatile CacheEntry<QWeatherUsageResponse> usageCache;

    /** 查询控制台摘要；两个控制台接口独立降级，手动刷新可绕过缓存。 */
    public synchronized QWeatherConsoleResponse getSummary(boolean refresh) {
        DailyContextConfigData config = configService.loadConfig();
        String key = cacheKey(config);
        QWeatherFinanceResponse finance = null;
        QWeatherUsageResponse usage = null;
        String financeError = null;
        String usageError = null;
        try {
            finance = finance(refresh, key, config);
        } catch (RuntimeException exception) {
            financeError = exception.getMessage();
        }
        try {
            usage = usage(refresh, key, config);
        } catch (RuntimeException exception) {
            usageError = exception.getMessage();
        }
        return new QWeatherConsoleResponse(finance, usage, financeError, usageError);
    }

    /** 配置变化后清理控制台缓存，避免旧凭据数据残留。 */
    public void clearCaches() {
        financeCache = null;
        usageCache = null;
    }

    private QWeatherFinanceResponse finance(
            boolean refresh,
            String key,
            DailyContextConfigData config
    ) {
        CacheEntry<QWeatherFinanceResponse> cached = financeCache;
        if (!refresh && cached != null && cached.usable(key)) return cached.value();
        QWeatherFinanceResponse loaded = consoleClient.fetchFinance(config.getQweather());
        financeCache = new CacheEntry<>(key, loaded, Instant.now().plus(CACHE_TTL));
        return loaded;
    }

    private QWeatherUsageResponse usage(
            boolean refresh,
            String key,
            DailyContextConfigData config
    ) {
        CacheEntry<QWeatherUsageResponse> cached = usageCache;
        if (!refresh && cached != null && cached.usable(key)) return cached.value();
        QWeatherUsageResponse loaded = consoleClient.fetchUsage(config.getQweather());
        usageCache = new CacheEntry<>(key, loaded, Instant.now().plus(CACHE_TTL));
        return loaded;
    }

    private static String cacheKey(DailyContextConfigData config) {
        return "%s:%s".formatted(config.getQweather().getApiHost(),
                Objects.hashCode(config.getQweather().getApiKey()));
    }

    private record CacheEntry<T>(String key, T value, Instant expiresAt) {
        private boolean usable(String expectedKey) {
            return key.equals(expectedKey) && Instant.now().isBefore(expiresAt);
        }
    }
}
