package butvan.agent.agents.project;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.agents.storage.AgentStorageProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProjectRegistryTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void importsCanonicalDirectoryAndPersistsIt() throws Exception {
        Path project = Files.createDirectories(temporaryDirectory.resolve("workspace/project-a"));
        ProjectRegistry registry = registry();

        ProjectSummary imported = registry.importProject("", project.resolve(".").toString());

        assertEquals("project-a", imported.name());
        assertEquals(project.toRealPath().toString(), imported.rootPath());
        assertEquals(ProjectAvailability.AVAILABLE, imported.availability());
        assertEquals(imported.id(), registry.listProjects().getFirst().id());
        assertTrue(Files.exists(project));
    }

    @Test
    void rejectsDuplicateCanonicalPathAndNeverDeletesDirectory() throws Exception {
        Path project = Files.createDirectories(temporaryDirectory.resolve("workspace/project-b"));
        ProjectRegistry registry = registry();
        ProjectSummary imported = registry.importProject("Project B", project.toString());

        assertThrows(IllegalArgumentException.class,
                () -> registry.importProject("duplicate", project.resolve("..").resolve("project-b").toString()));

        registry.remove(imported.id());
        assertTrue(Files.isDirectory(project));
        assertTrue(registry.listProjects().isEmpty());
    }

    @Test
    void reportsMissingDirectoryWithoutDroppingRegistration() throws Exception {
        Path project = Files.createDirectories(temporaryDirectory.resolve("workspace/project-c"));
        ProjectRegistry registry = registry();
        ProjectSummary imported = registry.importProject("Project C", project.toString());
        Files.delete(project);

        assertEquals(ProjectAvailability.MISSING, registry.listProjects().getFirst().availability());
        assertThrows(IllegalArgumentException.class, () -> registry.resolve(imported.id()));
        assertFalse(registry.listProjects().isEmpty());
    }

    private ProjectRegistry registry() {
        AgentStorageProperties storage = new AgentStorageProperties(temporaryDirectory.resolve("app-data"));
        CurrentUserProvider user = new CurrentUserProvider();
        return new ProjectRegistry(storage, user, new ObjectMapper().findAndRegisterModules());
    }
}
