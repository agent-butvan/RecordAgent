package butvan.agent.network.dailycontext.service;

import butvan.agent.network.dailycontext.config.DailyContextConfigData.QWeatherConfig;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.WeatherResponse;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
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
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(8));
        this.restClient = builder.clone().requestFactory(requestFactory).build();
    }

    /** 按配置地点读取当前天气并转换为内部稳定 DTO。 */
    public WeatherResponse fetchCurrent(QWeatherConfig config) {
        requireConfigured(config);
        String apiHost = DailyContextConfigService.normalizeAndValidateQWeatherHost(config.getApiHost());
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

    private static void requireConfigured(QWeatherConfig config) {
        if (config == null || !hasText(config.getApiHost()) || !hasText(config.getApiKey())
                || config.getLatitude() == null || config.getLongitude() == null) {
            throw new IllegalStateException("请先配置和风天气 API Host、密钥和经纬度");
        }
    }

    private static String coordinate(double value) {
        return java.math.BigDecimal.valueOf(value).stripTrailingZeros().toPlainString();
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
