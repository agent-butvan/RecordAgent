package butvan.agent.agents.context;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ModelProfileProposalGeneratorTest {

    @Test
    void parsesJsonFromOptionalMarkdownFence() {
        ModelProfileProposalGenerator generator = new ModelProfileProposalGenerator(
                null, null, new ObjectMapper());

        ProfileGenerationResult result = generator.parseResult("""
                ```json
                {"summary":"无需更新","proposedProfile":"原画像","changes":[]}
                ```
                """);

        assertEquals("无需更新", result.summary());
        assertEquals("原画像", result.proposedProfile());
        assertEquals(0, result.changes().size());
    }

    @Test
    void rejectsNonJsonModelOutput() {
        ModelProfileProposalGenerator generator = new ModelProfileProposalGenerator(
                null, null, new ObjectMapper());

        assertThrows(IllegalArgumentException.class, () -> generator.parseResult("无法生成"));
    }
}
