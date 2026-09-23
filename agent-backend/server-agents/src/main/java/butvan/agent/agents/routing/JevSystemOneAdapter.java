package butvan.agent.agents.routing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConversionException;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

/** 使用 Spring RestClient 调用 TypeSafe System One 的 HTTP Adapter。 */
@Component
public class JevSystemOneAdapter implements SystemOneGateway {

    /** 错误 body 最多参与解析的字符数，避免异常响应占用过多内存。 */
    private static final int MAX_ERROR_BODY_CHARS = 4_096;

    /** 供应商诊断提示的最大字符数；该值不会直接传播给前端。 */
    private static final int MAX_PROVIDER_MESSAGE_CHARS = 500;

    /** restClient：只用于访问 TypeSafe API 的短超时 HTTP Client。 */
    private final RestClient restClient;

    /** objectMapper：兼容解析官方 SDK 支持的多种错误 JSON 形状。 */
    private final ObjectMapper objectMapper;

    /**
     * 创建 System One HTTP Adapter。
     *
     * @param restClient 由 TypeSafeHttpConfiguration 创建的专用客户端
     */
    public JevSystemOneAdapter(
            @Qualifier("typeSafeRestClient") RestClient restClient,
            ObjectMapper objectMapper
    ) {
        this.restClient = restClient;
        this.objectMapper = objectMapper;
    }

    /**
     * 向 System One 发送一次批量 Noul 判断请求。
     *
     * @param apiKey 当前用户的 TypeSafe API Key
     * @param model Jev 模型名称或别名
     * @param state 当前用户可见的请求文本
     * @param questions 需要同时判断的能力组问题
     * @return 非空的结构化 Jev 响应
     * @throws JevGatewayException 网络失败、HTTP 错误或空响应时抛出
     */
    @Override
    public JevSystemOneResponse evaluate(
            String apiKey,
            String model,
            String state,
            Map<String, JevNoulQuestion> questions
    ) {
        // request：即将序列化为 JSON 的 System One 请求体。
        JevSystemOneRequest request = new JevSystemOneRequest(state, model, questions);
        try {
            // response：RestClient 反序列化得到的 System One 响应。
            JevSystemOneResponse response = restClient.post()
                    .uri("/v1/systemone")
                    .headers(headers -> {
                        // headers：仅属于当前请求的 HTTP Header 集合，用于写入最新 API Key。
                        headers.setBearerAuth(apiKey);
                    })
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(JevSystemOneResponse.class);

            if (response == null) {
                throw new JevGatewayException("TypeSafe 返回空响应");
            }
            return response;
        } catch (RestClientResponseException exception) {
            // exception：TypeSafe 返回 4xx/5xx 时由 RestClient 抛出的 HTTP 异常。
            String body = limit(exception.getResponseBodyAsString(), MAX_ERROR_BODY_CHARS);
            throw new JevGatewayException(
                    failureForResponse(
                            exception.getStatusCode().value(),
                            exception.getResponseHeaders()
                    ),
                    extractProviderMessage(body),
                    exception
            );
        } catch (RestClientException exception) {
            // exception：连接、超时或响应解析失败时产生的客户端异常。
            throw new JevGatewayException(
                    failureForClientException(exception),
                    "",
                    exception
            );
        }
    }

    /** 根据 HTTP 状态与响应头生成稳定、安全的失败分类。 */
    private ToolRoutingFailure failureForResponse(int status, HttpHeaders headers) {
        String requestId = headers == null ? "" : headers.getFirst("x-typesafe-request-id");
        Long retryAfterMillis = parseRetryAfterMillis(headers);
        ToolRoutingFailure.Code code;
        String message;
        boolean retryable = false;

        switch (status) {
            case 400, 404, 422 -> {
                code = ToolRoutingFailure.Code.INVALID_REQUEST;
                message = "Jev 请求或模型配置不兼容，已使用本地工具路由。";
            }
            case 401 -> {
                code = ToolRoutingFailure.Code.AUTHENTICATION;
                message = "Jev 鉴权失败，请检查 API Key；本次已使用本地工具路由。";
            }
            case 403 -> {
                code = ToolRoutingFailure.Code.PERMISSION;
                message = "Jev 当前凭据无权访问，已使用本地工具路由。";
            }
            case 408 -> {
                code = ToolRoutingFailure.Code.TIMEOUT;
                message = "Jev 请求超时，已使用本地工具路由。";
                retryable = true;
            }
            case 429 -> {
                code = ToolRoutingFailure.Code.RATE_LIMIT;
                message = "Jev 请求受限，已使用本地工具路由。";
                retryable = true;
            }
            case 529 -> {
                code = ToolRoutingFailure.Code.OVERLOADED;
                message = "Jev 服务暂时过载，已使用本地工具路由。";
                retryable = true;
            }
            default -> {
                code = status >= 500
                        ? ToolRoutingFailure.Code.SERVER_ERROR
                        : ToolRoutingFailure.Code.UNKNOWN;
                message = "Jev 服务暂不可用，已使用本地工具路由。";
                retryable = status >= 500;
            }
        }

        return new ToolRoutingFailure(
                code,
                status,
                requestId,
                retryAfterMillis,
                message,
                retryable
        );
    }

    /** 区分无响应的超时、网络错误与成功响应解析错误。 */
    private ToolRoutingFailure failureForClientException(RestClientException exception) {
        if (hasCause(exception, HttpTimeoutException.class)) {
            return new ToolRoutingFailure(
                    ToolRoutingFailure.Code.TIMEOUT,
                    null,
                    "",
                    null,
                    "Jev 请求超时，已使用本地工具路由。",
                    true
            );
        }
        if (hasCause(exception, HttpMessageConversionException.class)) {
            return ToolRoutingFailure.invalidResponse(
                    "Jev 响应格式异常，已使用本地工具路由。");
        }
        return new ToolRoutingFailure(
                ToolRoutingFailure.Code.NETWORK,
                null,
                "",
                null,
                "Jev 网络请求失败，已使用本地工具路由。",
                true
        );
    }

    /** 从官方 SDK 兼容的 JSON/text 错误形状中尽力提取诊断文本。 */
    private String extractProviderMessage(String body) {
        if (body == null || body.isBlank()) return "";
        try {
            JsonNode root = objectMapper.readTree(body);
            String message = firstText(root.path("message"));
            if (message.isEmpty()) message = nestedMessage(root.path("error"));
            if (message.isEmpty()) message = nestedMessage(root.path("detail"));
            if (message.isEmpty() && root.isTextual()) message = root.asText();
            return limit(normalizeDiagnostic(message), MAX_PROVIDER_MESSAGE_CHARS);
        } catch (Exception ignored) {
            return limit(normalizeDiagnostic(body), MAX_PROVIDER_MESSAGE_CHARS);
        }
    }

    /** 读取文本节点、对象的 message，或校验错误数组中的第一条 msg。 */
    private String nestedMessage(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return "";
        if (node.isTextual()) return node.asText();
        String message = firstText(node.path("message"));
        if (!message.isEmpty()) return message;
        if (node.isArray()) {
            for (JsonNode item : node) {
                message = firstText(item.path("msg"));
                if (!message.isEmpty()) return message;
            }
        }
        return "";
    }

    private String firstText(JsonNode node) {
        return node != null && node.isTextual() ? node.asText().strip() : "";
    }

    /** 解析官方 SDK 支持的 retry-after-ms 与标准 Retry-After。 */
    private Long parseRetryAfterMillis(HttpHeaders headers) {
        if (headers == null) return null;
        Long milliseconds = parseNonNegativeLong(headers.getFirst("retry-after-ms"));
        if (milliseconds != null) return milliseconds;

        String value = headers.getFirst(HttpHeaders.RETRY_AFTER);
        Long seconds = parseNonNegativeLong(value);
        if (seconds != null) return seconds * 1_000L;
        if (value == null || value.isBlank()) return null;
        try {
            Instant target = ZonedDateTime.parse(
                    value.strip(), DateTimeFormatter.RFC_1123_DATE_TIME).toInstant();
            return Math.max(0L, Duration.between(Instant.now(), target).toMillis());
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private Long parseNonNegativeLong(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            long parsed = Long.parseLong(value.strip());
            return parsed < 0 ? null : parsed;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private boolean hasCause(Throwable throwable, Class<? extends Throwable> type) {
        Throwable current = throwable;
        while (current != null) {
            if (type.isInstance(current)) return true;
            current = current.getCause();
        }
        return false;
    }

    private String normalizeDiagnostic(String value) {
        return value == null ? "" : value.replaceAll("\\s+", " ").strip();
    }

    private String limit(String value, int maxChars) {
        if (value == null || value.length() <= maxChars) return value == null ? "" : value;
        return value.substring(0, maxChars);
    }
}
