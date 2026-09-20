package butvan.agent.agents.routing;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;

/**
 * 创建与其他外部服务隔离的 TypeSafe 专用 HTTP Client。
 */
@Configuration
public class TypeSafeHttpConfiguration {

    /**
     * 创建 TypeSafe 专用的短超时 HTTP Client。
     *
     * @return 配置好地址与超时的 RestClient
     */
    @Bean
    @Qualifier("typeSafeRestClient")
    RestClient typeSafeRestClient() {
        // httpClient：设置连接超时的 JDK HTTP 客户端。
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(500))
                .build();

        // requestFactory：为 RestClient 补充响应读取超时。
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofMillis(3000));

        return RestClient.builder()
                .baseUrl("https://api.typesafe.ai")
                .requestFactory(requestFactory)
                .build();
    }
}
