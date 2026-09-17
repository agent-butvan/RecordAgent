package butvan.agent.network.service;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.agents.project.ProjectRegistry;
import butvan.agent.agents.project.ProjectSummary;
import butvan.agent.agents.storage.AgentStorageProperties;
import butvan.agent.network.dto.file.FileTreeNodeDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class FileTreeServiceTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void listsOnlyRegisteredProjectAndSkipsSymbolicLinks() throws Exception {
        Path projectRoot = Files.createDirectories(temporaryDirectory.resolve("projects/demo"));
        Files.writeString(projectRoot.resolve("README.md"), "demo");
        Files.createDirectories(projectRoot.resolve("src"));
        Files.writeString(projectRoot.resolve("src/App.tsx"), "export default null");
        try {
            Files.createSymbolicLink(projectRoot.resolve("outside"), temporaryDirectory);
        } catch (UnsupportedOperationException | IOException | SecurityException ignored) {
            // 不支持符号链接的文件系统仍可验证登记 ID 边界。
        }

        ProjectRegistry registry = new ProjectRegistry(
                new AgentStorageProperties(temporaryDirectory.resolve("runtime")),
                new CurrentUserProvider(),
                new ObjectMapper().findAndRegisterModules()
        );
        ProjectSummary project = registry.importProject("Demo", projectRoot.toString());
        FileTreeService service = new FileTreeService(registry);

        List<FileTreeNodeDto> nodes = service.list(project.id(), 3);

        assertEquals(List.of("src", "README.md"), nodes.stream().map(FileTreeNodeDto::name).toList());
        assertThrows(IllegalArgumentException.class, () -> service.list(projectRoot.toString(), 3));
    }
}
