package butvan.agent.network.dailycontext.service;

import butvan.agent.agents.config.LocalConfigService;
import butvan.agent.network.dailycontext.config.DailyContextConfigData;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.ConfigResponse;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.UpdateConfigRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.regex.Pattern;

/** 天气与节假日配置模块；对外只暴露脱敏状态，密钥仅在供应商请求时读取。 */
@Service
@RequiredArgsConstructor
public class DailyContextConfigService {
    private static final String CONFIG_NODE = "dailyContext";
    private static final Pattern QWEATHER_HOST = Pattern.compile(
            "^[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.qweatherapi\\.com$",
            Pattern.CASE_INSENSITIVE);

    private final LocalConfigService localConfigService;
    private final ObjectMapper objectMapper;

    /** 返回不包含密钥正文的设置状态。 */
    public ConfigResponse getPublicConfig() {
        DailyContextConfigData config = loadConfig();
        return new ConfigResponse(
                config.getQweather().getApiHost(),
                hasText(config.getQweather().getApiKey()),
                config.getQweather().getLocationName(),
                config.getQweather().getLatitude(),
                config.getQweather().getLongitude(),
                hasText(config.getTianApi().getApiKey()));
    }

    /** 保存设置；空密钥表示保留原值，只有明确 clear 标记才删除。 */
    public synchronized ConfigResponse update(UpdateConfigRequest request) {
        if (request == null) throw new IllegalArgumentException("缺少天气与节假日配置");
        validateLocation(request.latitude(), request.longitude());
        String host = normalizeAndValidateQWeatherHost(request.qweatherApiHost());

        DailyContextConfigData config = loadConfig();
        config.getQweather().setApiHost(host);
        config.getQweather().setLocationName(normalize(request.locationName()));
        config.getQweather().setLatitude(request.latitude());
        config.getQweather().setLongitude(request.longitude());
        updateSecret(config.getQweather()::setApiKey, config.getQweather().getApiKey(),
                request.qweatherApiKey(), request.clearQweatherApiKey());
        updateSecret(config.getTianApi()::setApiKey, config.getTianApi().getApiKey(),
                request.tianApiKey(), request.clearTianApiKey());

        LocalConfigService.ModelConfigData fullConfig = localConfigService.loadFullConfigData();
        fullConfig.setExtraField(CONFIG_NODE, config);
        localConfigService.saveFullConfigData(fullConfig);
        return getPublicConfig();
    }

    /** 供应商适配器内部读取完整配置。 */
    DailyContextConfigData loadConfig() {
        Object raw = localConfigService.loadFullConfigData().getExtraFields().get(CONFIG_NODE);
        DailyContextConfigData config = raw == null
                ? new DailyContextConfigData()
                : objectMapper.convertValue(raw, DailyContextConfigData.class);
        if (config.getQweather() == null) config.setQweather(new DailyContextConfigData.QWeatherConfig());
        if (config.getTianApi() == null) config.setTianApi(new DailyContextConfigData.TianApiConfig());
        return config;
    }

    private static void validateLocation(Double latitude, Double longitude) {
        if ((latitude == null) != (longitude == null)) {
            throw new IllegalArgumentException("纬度和经度必须同时填写");
        }
        if (latitude != null && (latitude < -90 || latitude > 90)) {
            throw new IllegalArgumentException("纬度必须位于 -90 至 90 之间");
        }
        if (longitude != null && (longitude < -180 || longitude > 180)) {
            throw new IllegalArgumentException("经度必须位于 -180 至 180 之间");
        }
    }

    /** 统一规范并约束请求目标，供应商客户端也会复用此校验以防本地配置被手工篡改。 */
    static String normalizeAndValidateQWeatherHost(String value) {
        String host = normalize(value).toLowerCase(Locale.ROOT);
        if (host.startsWith("https://")) host = host.substring("https://".length());
        if (host.endsWith("/")) host = host.substring(0, host.length() - 1);
        if (hasText(host) && !QWEATHER_HOST.matcher(host).matches()) {
            throw new IllegalArgumentException("和风天气 API Host 必须是控制台分配的 qweatherapi.com 域名");
        }
        return host;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static void updateSecret(
            java.util.function.Consumer<String> setter,
            String current,
            String incoming,
            boolean clear
    ) {
        if (clear) setter.accept("");
        else if (hasText(incoming)) setter.accept(incoming.trim());
        else setter.accept(current == null ? "" : current);
    }
}
