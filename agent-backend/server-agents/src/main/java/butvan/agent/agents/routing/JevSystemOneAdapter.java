package butvan.agent.agents.routing;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.util.Map;

/** 使用 Spring RestClient 调用 TypeSafe System One 的 HTTP Adapter。 */
@Component
public class JevSystemOneAdapter implements SystemOneGateway {

    /** restClient：只用于访问 TypeSafe API 的短超时 HTTP Client。 */
    private final RestClient restClient;

    /**
     * 创建 System One HTTP Adapter。
     *
     * @param restClient 由 TypeSafeHttpConfiguration 创建的专用客户端
     */
    public JevSystemOneAdapter(
            @Qualifier("typeSafeRestClient") RestClient restClient
    ) {
        this.restClient = restClient;
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
            throw new JevGatewayException(
                    "TypeSafe 请求失败，HTTP " + exception.getStatusCode().value(),
                    exception
            );
        } catch (RestClientException exception) {
            // exception：连接、超时或响应解析失败时产生的客户端异常。
            throw new JevGatewayException("TypeSafe 网络请求失败", exception);
        }
    }
}