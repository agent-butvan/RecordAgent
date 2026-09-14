package butvan.agent.network.context.controller;

import butvan.agent.agents.context.PersonalContextService;
import butvan.agent.agents.context.ProfileChange;
import butvan.agent.agents.context.ProfileChangeOperation;
import butvan.agent.agents.context.ProfileGenerationResult;
import butvan.agent.agents.context.ProfileMaintenanceService;
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
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
        Files.createDirectories(workspace.resolve("memory"));
        Files.writeString(workspace.resolve("memory/2026-09-14.md"), "用户明确偏好先给结论。");
        ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
        ApproximateTokenCounter counter = new ApproximateTokenCounter();
        PersonalContextService service = new PersonalContextService(
                storage, counter, mapper);
        ProfileMaintenanceService maintenanceService = new ProfileMaintenanceService(
                storage, service, request -> new ProfileGenerationResult(
                        "发现稳定偏好",
                        "- 表达偏好：先给结论",
                        List.of(new ProfileChange(ProfileChangeOperation.ADD, "表达偏好", "",
                                "先给结论", "用户明确表达",
                                List.of(request.evidence().getFirst().sourceId()), 0.95))),
                counter, mapper);
        mockMvc = MockMvcBuilders.standaloneSetup(
                new PersonalContextController(service, maintenanceService, new CurrentUserProvider())).build();
    }

    @Test
    void exposesEditPauseAndClearWorkflow() throws Exception {
        mockMvc.perform(get("/agent/personal-context"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.source").value("legacy"))
                .andExpect(jsonPath("$.data.profile").value("旧版画像"))
                .andExpect(jsonPath("$.data.maintenanceEnabled").value(false))
                .andExpect(jsonPath("$.data.revision").isNotEmpty());

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

    @Test
    void exposesMaintenanceCheckAndReviewWorkflow() throws Exception {
        mockMvc.perform(put("/agent/personal-context/maintenance/enabled")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled").value(true));

        String response = mockMvc.perform(post("/agent/personal-context/maintenance/check"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lastResult").value("proposal_ready"))
                .andExpect(jsonPath("$.data.pendingProposal.changes[0].sourceIds[0]").isNotEmpty())
                .andReturn().getResponse().getContentAsString();
        var root = new ObjectMapper().readTree(response).get("data").get("pendingProposal");
        String proposalId = root.get("id").asText();
        String revision = root.get("baseRevision").asText();

        mockMvc.perform(put("/agent/personal-context/proposals/{proposalId}/accept", proposalId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedRevision\":\"" + revision + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.profile").value("- 表达偏好：先给结论"));

        mockMvc.perform(get("/agent/personal-context/maintenance"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lastResult").value("accepted"))
                .andExpect(jsonPath("$.data.pendingProposal").doesNotExist());
    }
}
