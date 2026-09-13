package butvan.agent.agents.agent;

import butvan.agent.agents.context.ContextInjectionMiddleware;
import butvan.agent.agents.model.ModelHolder;
import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.agents.project.ProjectRegistry;
import butvan.agent.agents.session.SessionCatalogService;
import butvan.agent.agents.session.dto.CreateSessionRequest;
import butvan.agent.agents.session.dto.SessionKind;
import butvan.agent.agents.storage.AgentStorageProperties;
import butvan.agent.agents.subagent.AgentDefinitionLoader;
import butvan.agent.agents.subagent.SubagentCatalog;
import butvan.agent.agents.tool.ToolRegistry;
import butvan.agent.agents.usage.ApproximateTokenCounter;
import butvan.agent.agents.usage.TokenUsageMiddleware;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.agentscope.core.message.Msg;
import io.agentscope.core.model.ChatResponse;
import io.agentscope.core.model.GenerateOptions;
import io.agentscope.core.model.Model;
import io.agentscope.core.model.ToolSchema;
import io.agentscope.core.state.InMemoryAgentStateStore;
import io.agentscope.harness.agent.HarnessAgent;
import io.agentscope.harness.agent.middleware.WorkspaceContextMiddleware;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import reactor.core.publisher.Flux;

import java.nio.file.Path;
import java.nio.file.Files;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AgentFactoryTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void currentAgentDoesNotAutomaticallyInjectWorkspaceContext() throws Exception {
        Model model = new StubModel();
        ModelHolder modelHolder = new ModelHolder() {
            @Override
            public Model getModel() {
                return model;
            }
        };
        AgentStorageProperties storage = new AgentStorageProperties(temporaryDirectory);
        CurrentUserProvider currentUserProvider = new CurrentUserProvider();
        ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
        ProjectRegistry projectRegistry = new ProjectRegistry(storage, currentUserProvider, objectMapper);
        SessionCatalogService sessionCatalogService = new SessionCatalogService(
                storage, currentUserProvider, objectMapper, projectRegistry);
        SubagentCatalog subagentCatalog = new SubagentCatalog(
                new AgentDefinitionLoader(), storage) {
            @Override
            public List<io.agentscope.harness.agent.subagent.SubagentDeclaration> declarations() {
                return List.of();
            }
        };

        AgentFactory factory = new AgentFactory(
                modelHolder,
                new ToolRegistry(List.of()),
                storage,
                new InMemoryAgentStateStore(),
                null,
                null,
                subagentCatalog,
                new TokenUsageMiddleware(new ApproximateTokenCounter(), objectMapper),
                new ContextInjectionMiddleware(),
                sessionCatalogService,
                projectRegistry
        );

        try (HarnessAgent agent = factory.currentAgent()) {
            assertTrue(agent.getDelegate().getMiddlewares().stream()
                    .noneMatch(WorkspaceContextMiddleware.class::isInstance));
            List<Class<?>> middlewareOrder = agent.getDelegate().getMiddlewares().stream()
                    .map(Object::getClass).toList();
            assertTrue(middlewareOrder.indexOf(ContextInjectionMiddleware.class)
                            < middlewareOrder.indexOf(TokenUsageMiddleware.class),
                    "上下文注入必须先于 Token 计数，使归因看到最终模型输入");
            assertEquals(List.of("reset_equipped_tools"), agent.getToolkit().getToolSchemas().stream()
                    .map(ToolSchema::getName).toList());
            assertTrue(schemaTokens(agent.getToolkit().getToolSchemas()) < 800,
                    "默认 Tool Schema 应保持在 800 个估算 Token 以内");
        }
    }

    @Test
    void projectSessionsUseAgentsIsolatedByCanonicalRoot() throws Exception {
        Model model = new StubModel();
        ModelHolder modelHolder = new ModelHolder() {
            @Override
            public Model getModel() {
                return model;
            }
        };
        AgentStorageProperties storage = new AgentStorageProperties(temporaryDirectory.resolve("runtime"));
        CurrentUserProvider user = new CurrentUserProvider();
        ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
        ProjectRegistry projects = new ProjectRegistry(storage, user, mapper);
        SessionCatalogService sessions = new SessionCatalogService(storage, user, mapper, projects);
        SubagentCatalog subagents = new SubagentCatalog(new AgentDefinitionLoader(), storage) {
            @Override
            public List<io.agentscope.harness.agent.subagent.SubagentDeclaration> declarations() {
                return List.of();
            }
        };
        AgentFactory factory = new AgentFactory(
                modelHolder,
                new ToolRegistry(List.of()),
                storage,
                new InMemoryAgentStateStore(),
                null,
                null,
                subagents,
                new TokenUsageMiddleware(new ApproximateTokenCounter(), mapper),
                new ContextInjectionMiddleware(),
                sessions,
                projects
        );
        String firstProject = projects.importProject("first",
                Files.createDirectories(temporaryDirectory.resolve("projects/first")).toString()).id();
        String secondProject = projects.importProject("second",
                Files.createDirectories(temporaryDirectory.resolve("projects/second")).toString()).id();
        String firstSession = sessions.create(new CreateSessionRequest(SessionKind.PROJECT, "first", firstProject)).id();
        String secondSession = sessions.create(new CreateSessionRequest(SessionKind.PROJECT, "second", secondProject)).id();

        HarnessAgent first = factory.currentAgent(firstSession);
        HarnessAgent firstAgain = factory.currentAgent(firstSession);
        HarnessAgent second = factory.currentAgent(secondSession);

        assertSame(first, firstAgain);
        assertNotSame(first, second);
        first.close();
        second.close();
    }

    private int schemaTokens(List<ToolSchema> schemas) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        ApproximateTokenCounter counter = new ApproximateTokenCounter();
        int total = 0;
        for (ToolSchema schema : schemas) {
            total += counter.count(mapper.writeValueAsString(java.util.Map.of(
                    "name", schema.getName(),
                    "description", schema.getDescription(),
                    "parameters", schema.getParameters()
            )));
        }
        return total;
    }

    private static final class StubModel implements Model {

        @Override
        public Flux<ChatResponse> stream(
                List<Msg> messages,
                List<ToolSchema> tools,
                GenerateOptions options
        ) {
            return Flux.empty();
        }

        @Override
        public String getModelName() {
            return "test-model";
        }
    }
}
