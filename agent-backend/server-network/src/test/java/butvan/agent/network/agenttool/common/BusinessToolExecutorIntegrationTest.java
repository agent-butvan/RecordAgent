package butvan.agent.network.agenttool.common;

import butvan.agent.agents.tool.result.ToolResult;
import butvan.agent.network.config.database.LocalDatabaseConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest(classes = {
        LocalDatabaseConfiguration.class,
        JacksonAutoConfiguration.class,
        BusinessToolExecutor.class
})
class BusinessToolExecutorIntegrationTest {
    private static final Path DATABASE_PATH = createDatabasePath();

    @Autowired
    private BusinessToolExecutor executor;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("butvan.database.path", DATABASE_PATH::toString);
    }

    @Test
    void repeatedIdempotencyKeyReturnsStoredResultWithoutExecutingAgain() {
        AtomicInteger executions = new AtomicInteger();

        ToolResult<?> first = executor.write("owner-a", "test_write", "same-key", () -> {
            executions.incrementAndGet();
            return ToolResult.success("created", Map.of("id", "one"));
        });
        ToolResult<?> repeated = executor.write("owner-a", "test_write", "same-key", () -> {
            executions.incrementAndGet();
            return ToolResult.success("created twice", Map.of("id", "two"));
        });

        assertEquals(1, executions.get());
        assertEquals(first.summary(), repeated.summary());
        assertEquals(first.data(), repeated.data());
    }

    @Test
    void failedOperationRollsBackReservationAndCanBeRetried() {
        assertThrows(IllegalArgumentException.class, () -> executor.write(
                "owner-b", "test_write", "retry-key", () -> {
                    throw new IllegalArgumentException("invalid");
                }));

        ToolResult<?> retried = executor.write("owner-b", "test_write", "retry-key",
                () -> ToolResult.success("retried", Map.of("id", "ok")));

        assertEquals("retried", retried.summary());
    }

    private static Path createDatabasePath() {
        try {
            Path directory = Files.createTempDirectory("butvan-tool-executor-test-");
            return directory.resolve("butvan-test.db");
        } catch (IOException exception) {
            throw new IllegalStateException("无法创建测试数据库目录", exception);
        }
    }
}
