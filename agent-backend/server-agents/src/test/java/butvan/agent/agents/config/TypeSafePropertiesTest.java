package butvan.agent.agents.config;

import butvan.agent.agents.routing.ToolRoutingMode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TypeSafePropertiesTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void returnsDisabledConfigWhenFileDoesNotExist() {
        TypeSafeConfigData config = properties(temporaryDirectory.resolve("missing.json")).load();

        assertFalse(config.isReady());
        assertEquals(ToolRoutingMode.OFF, config.mode());
    }

    @Test
    void readsValidTypeSafeConfig() throws IOException {
        Path configPath = writeConfig("""
                {
                  "typesafe": {
                    "enabled": true,
                    "mode": "shadow",
                    "apiKey": "secret",
                    "model": "jev-latest",
                    "threshold": 0.82
                  }
                }
                """);

        TypeSafeConfigData config = properties(configPath).load();

        assertTrue(config.isReady());
        assertEquals(ToolRoutingMode.SHADOW, config.mode());
        assertEquals(0.82, config.threshold());
    }

    @Test
    void normalizesInvalidModeThresholdAndBlankModel() throws IOException {
        Path configPath = writeConfig("""
                {
                  "typesafe": {
                    "enabled": true,
                    "mode": "unexpected",
                    "apiKey": "secret",
                    "model": "  ",
                    "threshold": 2.0
                  }
                }
                """);

        TypeSafeConfigData config = properties(configPath).load();

        assertEquals(ToolRoutingMode.OFF, config.mode());
        assertEquals("jev-latest", config.model());
        assertEquals(0.75, config.threshold());
        assertFalse(config.isReady());
    }

    @Test
    void malformedJsonFailsClosedWithoutThrowing() throws IOException {
        Path configPath = writeConfig("{not-json");

        assertFalse(properties(configPath).load().isReady());
    }

    private TypeSafeProperties properties(Path configPath) {
        return new TypeSafeProperties(new ObjectMapper(), configPath);
    }

    private Path writeConfig(String content) throws IOException {
        Path configPath = temporaryDirectory.resolve("config.json");
        Files.writeString(configPath, content);
        return configPath;
    }
}
