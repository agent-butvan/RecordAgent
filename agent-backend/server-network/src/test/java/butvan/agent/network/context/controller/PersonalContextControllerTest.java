package butvan.agent.network.context.controller;

import butvan.agent.agents.context.PersonalContextService;
import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.agents.storage.AgentStorageProperties;
import butvan.agent.agents.usage.ApproximateTokenCounter;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PersonalContextControllerTest {

    @TempDir
    Path temporaryDirectory;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() throws IOException {
        AgentStorageProperties storage = new AgentStorageProperties(temporaryDirectory);
        Path workspace = storage.userWorkspaceDirectory("local-default");
        Files.createDirectories(workspace);
        Files.writeString(workspace.resolve("MEMORY.md"), "## User Profile\n旧版画像\n");
        PersonalContextService service = new PersonalContextService(
                storage, new ApproximateTokenCounter(), new ObjectMapper());
        mockMvc = MockMvcBuilders.standaloneSetup(
                new PersonalContextController(service, new CurrentUserProvider())).build();
    }

    @Test
    void exposesEditPauseAndClearWorkflow() throws Exception {
        mockMvc.perform(get("/agent/personal-context"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.source").value("legacy"))
                .andExpect(jsonPath("$.data.profile").value("旧版画像"));

        mockMvc.perform(put("/agent/personal-context/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"profile\":\"偏好先给结论\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.source").value("explicit"));

        mockMvc.perform(put("/agent/personal-context/enabled")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled").value(false));

        mockMvc.perform(delete("/agent/personal-context/profile"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.profile").value(""))
                .andExpect(jsonPath("$.data.source").value("explicit"));
    }
}
