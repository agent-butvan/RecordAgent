package butvan.agent.network.jev.controller;

import butvan.agent.agents.config.TypeSafeConfigData;
import butvan.agent.agents.config.TypeSafeProperties;
import butvan.agent.agents.routing.ToolRoutingMode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class JevControllerTest {

    private FakeTypeSafeProperties properties;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        properties = new FakeTypeSafeProperties();
        mockMvc = MockMvcBuilders.standaloneSetup(new JevController(properties)).build();
    }

    @Test
    void exposesSanitizedStatus() throws Exception {
        properties.status = config(false);

        mockMvc.perform(get("/agent/jev"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled").value(false))
                .andExpect(jsonPath("$.data.available").value(true))
                .andExpect(jsonPath("$.data.apiKey").doesNotExist());
    }

    @Test
    void updatesEnabledState() throws Exception {
        properties.status = config(false);

        mockMvc.perform(put("/agent/jev/enabled")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled").value(true));

        org.junit.jupiter.api.Assertions.assertTrue(properties.updatedEnabled);
    }

    private static TypeSafeConfigData config(boolean enabled) {
        return new TypeSafeConfigData(enabled, ToolRoutingMode.ACTIVE, "secret", "jev-latest", 0.75);
    }

    /** 不访问用户配置文件的 Controller 测试替身。 */
    private static final class FakeTypeSafeProperties extends TypeSafeProperties {
        private TypeSafeConfigData status = config(false);
        private boolean updatedEnabled;

        private FakeTypeSafeProperties() {
            super(new ObjectMapper());
        }

        @Override
        public TypeSafeConfigData load() {
            return status;
        }

        @Override
        public TypeSafeConfigData updateEnabled(boolean enabled) {
            updatedEnabled = enabled;
            status = config(enabled);
            return status;
        }
    }
}
