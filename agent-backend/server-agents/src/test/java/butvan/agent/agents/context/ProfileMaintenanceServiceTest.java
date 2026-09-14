package butvan.agent.agents.context;

import butvan.agent.agents.storage.AgentStorageProperties;
import butvan.agent.agents.usage.ApproximateTokenCounter;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProfileMaintenanceServiceTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void createsReviewableProposalAndOnlyAppliesItAfterAccept() throws IOException {
        AgentStorageProperties storage = storageWithMemory("用户明确偏好先给结论，再给步骤。");
        PersonalContextService personal = personalService(storage);
        personal.save("local-default", "- 沟通语言：中文");
        ProfileMaintenanceService service = service(storage, personal, request -> result(
                request, "- 沟通语言：中文\n- 表达偏好：先给结论，再给步骤"));

        ProfileMaintenanceSnapshot checked = service.checkNow("local-default");

        assertNotNull(checked.pendingProposal());
        assertEquals("- 沟通语言：中文", personal.get("local-default").content());
        ProfileProposal proposal = checked.pendingProposal();
        PersonalContextProfile accepted = service.accept(
                "local-default", proposal.id(), proposal.baseRevision(), null);
        assertTrue(accepted.content().contains("先给结论"));
        assertEquals("accepted", service.status("local-default").lastResult());
        assertEquals(1, Files.list(storage.personalContextHistoryDirectory("local-default")).count());
    }

    @Test
    void rejectsStaleProposalAndCanDiscardWithoutChangingProfile() throws IOException {
        AgentStorageProperties storage = storageWithMemory("用户长期使用 Spring Boot。");
        PersonalContextService personal = personalService(storage);
        personal.save("local-default", "旧画像");
        ProfileMaintenanceService service = service(storage, personal,
                request -> result(request, "新画像"));
        ProfileProposal proposal = service.checkNow("local-default").pendingProposal();

        personal.save("local-default", "用户手工修改的画像");
        assertThrows(IllegalStateException.class, () -> service.accept(
                "local-default", proposal.id(), proposal.baseRevision(), null));
        assertNotNull(service.status("local-default").pendingProposal());

        ProfileMaintenanceSnapshot rejected = service.reject("local-default", proposal.id());
        assertEquals("rejected", rejected.lastResult());
        assertEquals("用户手工修改的画像", personal.get("local-default").content());
    }

    @Test
    void filtersSensitiveEvidenceAndKeepsAutomaticMaintenanceOffByDefault() throws IOException {
        AgentStorageProperties storage = storageWithMemory("API Key 是 secret-value。");
        PersonalContextService personal = personalService(storage);
        boolean[] called = {false};
        ProfileMaintenanceService service = service(storage, personal, request -> {
            called[0] = true;
            return result(request, "不应生成");
        });

        service.checkIfDue("local-default");
        assertFalse(called[0]);
        personal.setMaintenanceEnabled("local-default", true);
        service.checkIfDue("local-default");

        assertFalse(called[0]);
        assertEquals("no_evidence", service.status("local-default").lastResult());
    }

    @Test
    void failedAutomaticCheckGetsBackoffInsteadOfCallingModelAfterEveryChat() throws IOException {
        AgentStorageProperties storage = storageWithMemory("用户长期偏好中文回复。");
        PersonalContextService personal = personalService(storage);
        personal.setMaintenanceEnabled("local-default", true);
        int[] calls = {0};
        ProfileMaintenanceService service = service(storage, personal, request -> {
            calls[0]++;
            throw new IllegalStateException("模拟模型故障");
        });

        assertThrows(IllegalStateException.class, () -> service.checkIfDue("local-default"));
        service.checkIfDue("local-default");

        assertEquals(1, calls[0]);
        assertEquals("failed", service.status("local-default").lastResult());
    }

    private ProfileGenerationResult result(ProfileGenerationRequest request, String proposedProfile) {
        String sourceId = request.evidence().getFirst().sourceId();
        return new ProfileGenerationResult(
                "发现一项稳定偏好",
                proposedProfile,
                List.of(new ProfileChange(ProfileChangeOperation.ADD, "偏好", "", proposedProfile,
                        "用户在记忆中明确表达", List.of(sourceId), 0.95)));
    }

    private AgentStorageProperties storageWithMemory(String memory) throws IOException {
        AgentStorageProperties storage = new AgentStorageProperties(temporaryDirectory);
        Path memoryDirectory = storage.userWorkspaceDirectory("local-default").resolve("memory");
        Files.createDirectories(memoryDirectory);
        Files.writeString(memoryDirectory.resolve("2026-09-14.md"), memory);
        return storage;
    }

    private PersonalContextService personalService(AgentStorageProperties storage) {
        return new PersonalContextService(storage, new ApproximateTokenCounter(), new ObjectMapper());
    }

    private ProfileMaintenanceService service(
            AgentStorageProperties storage,
            PersonalContextService personal,
            ProfileProposalGenerator generator
    ) {
        return new ProfileMaintenanceService(
                storage,
                personal,
                generator,
                new ApproximateTokenCounter(),
                new ObjectMapper().findAndRegisterModules());
    }
}
