package butvan.agent.agents.routing;

import butvan.agent.agents.config.TypeSafeConfigData;
import butvan.agent.agents.config.TypeSafeProperties;
import butvan.agent.agents.tool.ToolCapabilityCatalog;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JevToolCapabilityRouterTest {

    private final ToolCapabilityCatalog catalog = new ToolCapabilityCatalog();
    private TypeSafeConfigData configured = TypeSafeConfigData.disabled();
    private RuntimeException configurationFailure;
    private final TypeSafeProperties properties = new TypeSafeProperties(new ObjectMapper()) {
        @Override
        public TypeSafeConfigData load() {
            if (configurationFailure != null) throw configurationFailure;
            return configured;
        }
    };
    private final SystemOneGateway gateway = mock(SystemOneGateway.class);
    private final JevToolCapabilityRouter router =
            new JevToolCapabilityRouter(properties, catalog, gateway);

    @Test
    void selectsEveryGroupAtOrAboveThreshold() {
        configured = config(ToolRoutingMode.ACTIVE, 0.75);
        when(gateway.evaluate(anyString(), anyString(), anyString(), anyMap()))
                .thenAnswer(invocation -> response(invocation.getArgument(3)));

        ToolRoutingDecision decision = router.route(
                new ToolRoutingRequest("搜索资料并写入项目", catalog.groupNames()));

        assertEquals(ToolRoutingDecision.Status.ACTIVE, decision.status());
        assertEquals(java.util.Set.of("workspace", "web"), decision.selectedGroups());
    }

    @Test
    void offModeDoesNotCallGateway() {
        configured = TypeSafeConfigData.disabled();

        ToolRoutingDecision decision = router.route(
                new ToolRoutingRequest("普通问题", catalog.groupNames()));

        assertEquals(ToolRoutingDecision.Status.OFF, decision.status());
        verify(gateway, never()).evaluate(anyString(), anyString(), anyString(), anyMap());
    }

    @Test
    void gatewayAndConfigurationFailuresFallBack() {
        configurationFailure = new IllegalStateException("broken config");

        ToolRoutingDecision decision = router.route(
                new ToolRoutingRequest("普通问题", catalog.groupNames()));

        assertEquals(ToolRoutingDecision.Status.FALLBACK, decision.status());
        assertEquals(ToolRoutingFailure.Code.UNKNOWN, decision.failure().code());
    }

    @Test
    void preservesSafeGatewayFailureInFallbackDecision() {
        configured = config(ToolRoutingMode.ACTIVE, 0.75);
        ToolRoutingFailure failure = new ToolRoutingFailure(
                ToolRoutingFailure.Code.AUTHENTICATION,
                401,
                "req_auth",
                null,
                "Jev 鉴权失败，已使用本地工具路由。",
                false
        );
        when(gateway.evaluate(anyString(), anyString(), anyString(), anyMap()))
                .thenThrow(new JevGatewayException(failure, "provider detail", null));

        ToolRoutingDecision decision = router.route(
                new ToolRoutingRequest("普通问题", catalog.groupNames()));

        assertEquals(ToolRoutingDecision.Status.FALLBACK, decision.status());
        assertEquals(failure, decision.failure());
    }

    @Test
    void truncatesLongInputBeforeCallingGateway() {
        configured = config(ToolRoutingMode.SHADOW, 0.75);
        when(gateway.evaluate(anyString(), anyString(), anyString(), anyMap()))
                .thenAnswer(invocation -> response(invocation.getArgument(3)));
        ArgumentCaptor<String> state = ArgumentCaptor.forClass(String.class);

        router.route(new ToolRoutingRequest("x".repeat(5_000), catalog.groupNames()));

        verify(gateway).evaluate(anyString(), anyString(), state.capture(), anyMap());
        assertEquals(4_000, state.getValue().length());
    }

    @Test
    void malformedAnswersFallBack() {
        configured = config(ToolRoutingMode.ACTIVE, 0.75);
        when(gateway.evaluate(anyString(), anyString(), anyString(), anyMap()))
                .thenReturn(new JevSystemOneResponse("jev-test", Map.of(), new JevUsage(1, 1)));

        ToolRoutingDecision decision = router.route(
                new ToolRoutingRequest("普通问题", catalog.groupNames()));

        assertEquals(ToolRoutingDecision.Status.FALLBACK, decision.status());
        assertTrue(decision.selectedGroups().isEmpty());
    }

    @Test
    void nonFiniteProbabilityFallsBack() {
        configured = config(ToolRoutingMode.ACTIVE, 0.75);
        when(gateway.evaluate(anyString(), anyString(), anyString(), anyMap()))
                .thenAnswer(invocation -> {
                    Map<String, JevNoulQuestion> questions = invocation.getArgument(3);
                    Map<String, JevNoulAnswer> answers = new LinkedHashMap<>();
                    questions.keySet().forEach(group ->
                            answers.put(group, new JevNoulAnswer("noul", Double.NaN)));
                    return new JevSystemOneResponse(
                            "jev-test",
                            Map.copyOf(answers),
                            new JevUsage(1, 1)
                    );
                });

        ToolRoutingDecision decision = router.route(
                new ToolRoutingRequest("普通问题", catalog.groupNames()));

        assertEquals(ToolRoutingDecision.Status.FALLBACK, decision.status());
        assertTrue(decision.selectedGroups().isEmpty());
    }

    private TypeSafeConfigData config(ToolRoutingMode mode, double threshold) {
        return new TypeSafeConfigData(true, mode, "secret", "jev-latest", threshold);
    }

    private JevSystemOneResponse response(Map<String, JevNoulQuestion> questions) {
        Map<String, JevNoulAnswer> answers = new LinkedHashMap<>();
        questions.keySet().forEach(group -> {
            double probability = switch (group) {
                case "workspace" -> 0.95;
                case "web" -> 0.75;
                default -> 0.10;
            };
            answers.put(group, new JevNoulAnswer("noul", probability));
        });
        return new JevSystemOneResponse("jev-test", Map.copyOf(answers), new JevUsage(10, 2));
    }
}
