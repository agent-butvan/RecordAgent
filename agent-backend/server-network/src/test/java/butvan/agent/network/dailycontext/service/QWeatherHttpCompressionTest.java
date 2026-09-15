package butvan.agent.network.dailycontext.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.io.ByteArrayOutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.zip.GZIPOutputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** 和风天气 HTTP 传输测试，覆盖供应商默认返回 gzip 响应的场景。 */
class QWeatherHttpCompressionTest {

    @Test
    void requestFactory_decompressesGzipJsonResponse() throws Exception {
        byte[] compressed = gzip("""
                {"condition":{"text":"多云","code":"101"}}
                """);
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/weather", exchange -> {
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.getResponseHeaders().add("Content-Encoding", "gzip");
            exchange.sendResponseHeaders(200, compressed.length);
            exchange.getResponseBody().write(compressed);
            exchange.close();
        });
        server.start();

        try {
            JsonNode payload = RestClient.builder()
                    .requestFactory(QWeatherClient.createRequestFactory())
                    .build()
                    .get()
                    .uri("http://127.0.0.1:" + server.getAddress().getPort() + "/weather")
                    .retrieve()
                    .body(JsonNode.class);

            assertEquals("多云", payload.path("condition").path("text").asText());
        } finally {
            server.stop(0);
        }
    }

    private static byte[] gzip(String value) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (GZIPOutputStream gzip = new GZIPOutputStream(output)) {
            gzip.write(value.getBytes(StandardCharsets.UTF_8));
        }
        return output.toByteArray();
    }
}
