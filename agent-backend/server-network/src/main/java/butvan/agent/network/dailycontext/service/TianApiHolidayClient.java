package butvan.agent.network.dailycontext.service;

import butvan.agent.network.dailycontext.config.DailyContextConfigData.TianApiConfig;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.HolidayResponse;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.LocalDate;

/** 天聚数行节假日接口适配器。 */
@Component
public class TianApiHolidayClient {
    private static final String ENDPOINT = "https://apis.tianapi.com/jiejiari/index";
    private final RestClient restClient;

    public TianApiHolidayClient(RestClient.Builder builder) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(8));
        this.restClient = builder.clone().requestFactory(requestFactory).build();
    }

    /** 查询指定日期的工作日、节假日或调休状态。 */
    public HolidayResponse fetch(LocalDate date, TianApiConfig config) {
        if (config == null || config.getApiKey() == null || config.getApiKey().isBlank()) {
            throw new IllegalStateException("请先配置天聚数行 API Key");
        }
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("key", config.getApiKey());
        form.add("date", date.toString());
        form.add("type", "0");
        form.add("mode", "0");
        try {
            JsonNode payload = restClient.post()
                    .uri(ENDPOINT)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(JsonNode.class);
            return parse(payload);
        } catch (Exception exception) {
            throw new IllegalStateException("节假日信息暂时不可用，请检查天聚数行密钥和接口权限", exception);
        }
    }

    static HolidayResponse parse(JsonNode payload) {
        if (payload == null || payload.path("code").asInt() != 200) {
            String message = payload == null ? "空响应" : payload.path("msg").asText("未知错误");
            throw new IllegalStateException("天聚数行返回错误：" + message);
        }
        JsonNode result = payload.path("result");
        JsonNode list = result.path("list");
        if (list.isArray()) result = list.path(0);
        else if (result.isArray()) result = result.path(0);
        if (!result.isObject()) throw new IllegalStateException("天聚数行返回的数据格式无法识别");
        String lunarDate = result.path("lunarmonth").asText("") + result.path("lunarday").asText("");
        return new HolidayResponse(
                result.path("name").asText(""),
                result.path("info").asText("工作日"),
                result.path("daycode").asInt(0),
                result.path("isnotwork").asInt(0) == 1,
                result.path("wage").asInt(1),
                lunarDate,
                result.path("tip").asText(""));
    }
}
