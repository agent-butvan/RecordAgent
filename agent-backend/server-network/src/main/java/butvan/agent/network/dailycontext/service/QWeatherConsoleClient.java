package butvan.agent.network.dailycontext.service;

import butvan.agent.network.dailycontext.config.DailyContextConfigData.QWeatherConfig;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.QWeatherApiUsageResponse;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.QWeatherFinanceResponse;
import butvan.agent.network.dailycontext.dto.DailyContextDtos.QWeatherUsageResponse;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.math.BigDecimal;
import java.net.URI;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 和风天气控制台 API 适配器，仅返回设置页需要的脱敏财务与请求量摘要。 */
@Component
public class QWeatherConsoleClient {
    private final RestClient restClient;

    public QWeatherConsoleClient(RestClient.Builder builder) {
        this.restClient = builder.clone()
                .requestFactory(QWeatherClient.createRequestFactory())
                .build();
    }

    /** 查询当前帐号财务汇总。 */
    public QWeatherFinanceResponse fetchFinance(QWeatherConfig config) {
        return parseFinance(fetch(config, "/finance/v1/summary", "财务汇总"));
    }

    /** 查询当前帐号最近 24 小时请求量。 */
    public QWeatherUsageResponse fetchUsage(QWeatherConfig config) {
        return parseUsage(fetch(config, "/metrics/v1/stats", "请求量统计"));
    }

    private JsonNode fetch(QWeatherConfig config, String path, String label) {
        String apiHost = requireAuthentication(config);
        try {
            return restClient.get()
                    .uri(URI.create("https://" + apiHost + path))
                    .header("X-QW-Api-Key", config.getApiKey())
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientResponseException exception) {
            if (exception.getStatusCode().value() == 403) {
                throw new IllegalStateException("请在和风天气凭据中启用控制台 API 的" + label + "权限", exception);
            }
            if (exception.getStatusCode().value() == 401) {
                throw new IllegalStateException("和风天气控制台 API 认证失败，请检查 API Host 和密钥", exception);
            }
            throw new IllegalStateException("和风天气" + label + "暂时不可用", exception);
        } catch (Exception exception) {
            throw new IllegalStateException("和风天气" + label + "暂时不可用", exception);
        }
    }

    static QWeatherFinanceResponse parseFinance(JsonNode payload) {
        if (payload == null || !hasText(payload.path("asOf").asText())
                || !hasText(payload.path("currency").asText())) {
            throw new IllegalStateException("和风天气财务汇总格式无法识别");
        }
        JsonNode charges = payload.path("accruedCharges");
        JsonNode pendingBills = payload.path("pendingBills");
        BigDecimal pendingAmountDue = BigDecimal.ZERO;
        if (pendingBills.isArray()) {
            for (JsonNode bill : pendingBills) {
                pendingAmountDue = pendingAmountDue.add(decimal(bill.path("amountDue")));
            }
        }
        return new QWeatherFinanceResponse(
                Instant.parse(payload.path("asOf").asText()),
                payload.path("currency").asText(),
                decimal(payload.path("balance")),
                decimal(charges.path("previousDay")),
                decimal(charges.path("thisMonth")),
                decimal(charges.path("sinceLastBill")),
                pendingBills.isArray() ? pendingBills.size() : 0,
                pendingAmountDue);
    }

    static QWeatherUsageResponse parseUsage(JsonNode payload) {
        if (payload == null || !hasText(payload.path("asOf").asText())) {
            throw new IllegalStateException("和风天气请求量统计格式无法识别");
        }
        Map<String, long[]> totals = new LinkedHashMap<>();
        mergeUsage(payload.path("success"), totals, 0);
        mergeUsage(payload.path("errors"), totals, 1);
        List<QWeatherApiUsageResponse> apis = totals.entrySet().stream()
                .map(entry -> new QWeatherApiUsageResponse(
                        entry.getKey(), entry.getValue()[0], entry.getValue()[1]))
                .toList();
        return new QWeatherUsageResponse(
                Instant.parse(payload.path("asOf").asText()),
                apis.stream().mapToLong(QWeatherApiUsageResponse::successRequests).sum(),
                apis.stream().mapToLong(QWeatherApiUsageResponse::errorRequests).sum(),
                apis);
    }

    private static void mergeUsage(JsonNode entries, Map<String, long[]> totals, int index) {
        if (!entries.isArray()) return;
        for (JsonNode entry : entries) {
            String api = entry.path("api").asText();
            if (!hasText(api)) continue;
            long total = 0;
            for (JsonNode hour : entry.path("hours")) total += hour.asLong();
            totals.computeIfAbsent(api, ignored -> new long[2])[index] += total;
        }
    }

    private static String requireAuthentication(QWeatherConfig config) {
        if (config == null || !hasText(config.getApiHost()) || !hasText(config.getApiKey())) {
            throw new IllegalStateException("请先保存和风天气 API Host 和密钥");
        }
        return DailyContextConfigService.normalizeAndValidateQWeatherHost(config.getApiHost());
    }

    private static BigDecimal decimal(JsonNode node) {
        return node == null || !node.isNumber() ? BigDecimal.ZERO : node.decimalValue();
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
