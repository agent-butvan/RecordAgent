package butvan.agent.agents.routing;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class JevSystemOneAdapterTest {

    private MockRestServiceServer server;
    private JevSystemOneAdapter adapter;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        adapter = new JevSystemOneAdapter(
                builder.baseUrl("https://api.typesafe.ai").build(),
                new ObjectMapper());
    }

    @Test
    void sendsOfficialInstructionsFieldAndParsesNoulResponse() {
        server.expect(requestTo("https://api.typesafe.ai/v1/systemone"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer secret"))
                .andExpect(jsonPath("$.state").value("查询天气"))
                .andExpect(jsonPath("$.model").value("jev-latest"))
                .andExpect(jsonPath("$.questions.web.instructions")
                        .value("是否需要联网搜索"))
                .andRespond(withSuccess("""
                        {
                          "model": "jev-test",
                          "answers": {
                            "web": {"type": "noul", "noul": 0.91}
                          },
                          "usage": {"input_tokens": 10, "output_tokens": 2}
                        }
                        """, MediaType.APPLICATION_JSON));

        JevSystemOneResponse response = adapter.evaluate(
                "secret",
                "jev-latest",
                "查询天气",
                Map.of("web", JevNoulQuestion.of("是否需要联网搜索")));

        assertEquals(0.91, response.answers().get("web").noul());
        assertEquals(10, response.usage().inputTokens());
        server.verify();
    }

    @Test
    void convertsHttpErrorsWithoutLeakingApiKey() {
        server.expect(requestTo("https://api.typesafe.ai/v1/systemone"))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS)
                        .header("x-typesafe-request-id", "req_rate_limit")
                        .header("retry-after-ms", "750")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("""
                                {
                                  "detail": {
                                    "message": "Too many requests"
                                  }
                                }
                                """));

        JevGatewayException exception = assertThrows(JevGatewayException.class, () ->
                adapter.evaluate(
                        "secret-value",
                        "jev-latest",
                        "private user text",
                        Map.of("web", JevNoulQuestion.of("是否需要联网搜索"))));

        assertFalse(exception.getMessage().contains("secret-value"));
        assertFalse(exception.getMessage().contains("private user text"));
        assertEquals(ToolRoutingFailure.Code.RATE_LIMIT, exception.failure().code());
        assertEquals(429, exception.failure().httpStatus());
        assertEquals("req_rate_limit", exception.failure().requestId());
        assertEquals(750L, exception.failure().retryAfterMillis());
        assertEquals("Too many requests", exception.providerMessage());
        assertTrue(exception.failure().retryable());
        server.verify();
    }

    @Test
    void classifiesAuthenticationAndReadsNestedProviderMessage() {
        server.expect(requestTo("https://api.typesafe.ai/v1/systemone"))
                .andRespond(withStatus(HttpStatus.UNAUTHORIZED)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("""
                                {
                                  "detail": {
                                    "error_type": "authentication_error",
                                    "message": "Cannot authenticate with the server."
                                  }
                                }
                                """));

        JevGatewayException exception = assertThrows(JevGatewayException.class, () ->
                adapter.evaluate(
                        "invalid-secret",
                        "jev-latest",
                        "private user text",
                        Map.of("web", JevNoulQuestion.of("是否需要联网搜索"))));

        assertEquals(ToolRoutingFailure.Code.AUTHENTICATION, exception.failure().code());
        assertEquals(401, exception.failure().httpStatus());
        assertEquals("Cannot authenticate with the server.", exception.providerMessage());
        assertNull(exception.failure().retryAfterMillis());
        assertFalse(exception.failure().retryable());
        server.verify();
    }

    @Test
    void classifiesOfficialOverloadStatusAndPlainTextBody() {
        server.expect(requestTo("https://api.typesafe.ai/v1/systemone"))
                .andRespond(withStatus(HttpStatusCode.valueOf(529))
                        .contentType(MediaType.TEXT_PLAIN)
                        .body("temporarily overloaded"));

        JevGatewayException exception = assertThrows(JevGatewayException.class, () ->
                adapter.evaluate(
                        "secret",
                        "jev-latest",
                        "private user text",
                        Map.of("web", JevNoulQuestion.of("是否需要联网搜索"))));

        assertEquals(ToolRoutingFailure.Code.OVERLOADED, exception.failure().code());
        assertEquals("temporarily overloaded", exception.providerMessage());
        assertTrue(exception.failure().retryable());
        server.verify();
    }
}
