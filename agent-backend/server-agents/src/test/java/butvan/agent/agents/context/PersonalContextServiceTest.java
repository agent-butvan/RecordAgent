package butvan.agent.agents.context;

import butvan.agent.agents.storage.AgentStorageProperties;
import butvan.agent.agents.usage.ApproximateTokenCounter;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class PersonalContextServiceTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void supportsLegacyFallbackEditPauseAndClear() throws IOException {
        AgentStorageProperties storage = new AgentStorageProperties(temporaryDirectory);
        Path workspace = storage.userWorkspaceDirectory("local-default");
        Files.createDirectories(workspace);
        Files.writeString(workspace.resolve("MEMORY.md"), "## User Profile\n偏好简短中文。\n");
        PersonalContextService service = service(storage);

        assertEquals("legacy", service.get("local-default").source());
        assertEquals("偏好简短中文。", service.get("local-default").content());

        assertEquals("显式画像", service.save("local-default", "  显式画像  ").content());
        assertEquals("explicit", service.get("local-default").source());
        assertFalse(service.setEnabled("local-default", false).enabled());
        assertTrue(service.setEnabled("local-default", true).enabled());

        PersonalContextProfile cleared = service.clear("local-default");
        assertEquals("", cleared.content());
        assertEquals("explicit", cleared.source());
    }

    @Test
    void validatesUserAndContentBoundaries() {
        PersonalContextService service = service(new AgentStorageProperties(temporaryDirectory));
        assertThrows(IllegalArgumentException.class, () -> service.get("../escape"));
        assertThrows(IllegalArgumentException.class,
                () -> service.save("local-default", "x".repeat(PersonalContextService.MAX_PROFILE_CHARS + 1)));
    }

    @Test
    void rejectsSymlinkedUserWorkspace() throws IOException {
        AgentStorageProperties storage = new AgentStorageProperties(temporaryDirectory);
        Path outside = temporaryDirectory.resolve("outside");
        Files.createDirectories(outside);
        try {
            Files.createSymbolicLink(storage.getWorkspaceDirectory().resolve("local-default"), outside);
        } catch (IOException | UnsupportedOperationException exception) {
            assumeTrue(false, "当前环境不允许创建符号链接");
        }

        assertThrows(IllegalArgumentException.class, () -> service(storage).get("local-default"));
    }

    private PersonalContextService service(AgentStorageProperties storage) {
        return new PersonalContextService(storage, new ApproximateTokenCounter(), new ObjectMapper());
    }
}
