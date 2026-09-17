package butvan.agent.network.dailycontext.service;

import butvan.agent.network.dailycontext.config.DailyContextConfigData.QWeatherConfig;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.LocationResponse;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.WeatherResponse;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.time.Duration;

/** 和风天气 v1 实况接口适配器。 */
@Component
public class QWeatherClient {
    private static final String ATTRIBUTION_URL = "https://developer.qweather.com/attribution.html";
    private final RestClient restClient;

    public QWeatherClient(RestClient.Builder builder) {
        this.restClient = builder.clone().requestFactory(createRequestFactory()).build();
    }

    static ClientHttpRequestFactory createRequestFactory() {
        HttpComponentsClientHttpRequestFactory requestFactory = new HttpComponentsClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(8));
        return requestFactory;
    }

    /** 按配置地点读取当前天气并转换为内部稳定 DTO。 */
    public WeatherResponse fetchCurrent(QWeatherConfig config) {
        String apiHost = requireAuthentication(config);
        if (config.getLatitude() == null || config.getLongitude() == null) {
            throw new IllegalStateException("请先配置天气地点的经纬度");
        }
        URI uri = URI.create("https://%s/weather/v1/current/%s/%s?localTime=true&lang=zh"
                .formatted(apiHost, coordinate(config.getLatitude()), coordinate(config.getLongitude())));
        try {
            JsonNode payload = restClient.get()
                    .uri(uri)
                    .header("X-QW-Api-Key", config.getApiKey())
                    .retrieve()
                    .body(JsonNode.class);
            return parse(payload, config.getLocationName());
        } catch (Exception exception) {
            throw new IllegalStateException("和风天气暂时不可用，请检查 API Host、密钥和地点配置", exception);
        }
    }

    /** 通过设备经纬度反查和风地点名称，供设置页自动填充。 */
    public LocationResponse lookupLocation(double latitude, double longitude, QWeatherConfig config) {
        String apiHost = requireAuthentication(config);
        URI uri = URI.create("https://%s/geo/v2/city/lookup?location=%s%%2C%s&number=1&lang=zh"
                .formatted(apiHost, coordinate(longitude), coordinate(latitude)));
        try {
            JsonNode payload = restClient.get()
                    .uri(uri)
                    .header("X-QW-Api-Key", config.getApiKey())
                    .retrieve()
                    .body(JsonNode.class);
            return parseLocation(payload);
        } catch (Exception exception) {
            throw new IllegalStateException("已取得经纬度，但和风地点名称识别失败，请检查 GeoAPI 权限", exception);
        }
    }

    static WeatherResponse parse(JsonNode payload, String locationName) {
        if (payload == null || !payload.path("condition").isObject()) {
            throw new IllegalStateException("和风天气返回的数据格式无法识别");
        }
        JsonNode wind = payload.path("wind");
        return new WeatherResponse(
                hasText(locationName) ? locationName : "当前地点",
                payload.path("condition").path("text").asText("未知"),
                payload.path("condition").path("code").asText("999"),
                payload.path("temperature").path("value").asDouble(),
                payload.path("temperature").path("unit").asText("°C"),
                payload.path("feelsLike").path("value").asDouble(),
                (int) Math.round(payload.path("humidity").asDouble() * 100),
                wind.path("direction").path("compass").asText(""),
                wind.path("speed").path("value").asDouble(),
                wind.path("speed").path("unit").asText("m/s"),
                ATTRIBUTION_URL);
    }

    static LocationResponse parseLocation(JsonNode payload) {
        JsonNode location = payload == null ? null : payload.path("location").path(0);
        if (payload == null || !"200".equals(payload.path("code").asText())
                || location == null || !location.isObject()) {
            throw new IllegalStateException("和风 GeoAPI 返回的数据格式无法识别");
        }
        return new LocationResponse(
                location.path("name").asText("当前位置"),
                location.path("adm2").asText(""),
                location.path("country").asText(""));
    }

    private static String requireAuthentication(QWeatherConfig config) {
        if (config == null || !hasText(config.getApiHost()) || !hasText(config.getApiKey())) {
            throw new IllegalStateException("请先保存和风天气 API Host 和密钥");
        }
        return DailyContextConfigService.normalizeAndValidateQWeatherHost(config.getApiHost());
    }

    private static String coordinate(double value) {
        return java.math.BigDecimal.valueOf(value).stripTrailingZeros().toPlainString();
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
