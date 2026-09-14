package butvan.agent.agents.usage;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class InputTokenBreakdownCompatibilityTest {

    @Test
    void readsHistoricalJsonWithoutPersonalContextFields() throws Exception {
        InputTokenBreakdown breakdown = new ObjectMapper().readValue("""
                {"systemPromptTokens":5,"historyTokens":3,"currentUserTokens":2,
                 "toolSchemaTokens":1,"toolResultTokens":4,"ragContextTokens":6,"otherTokens":7}
                """, InputTokenBreakdown.class);

        assertEquals(0, breakdown.profileContextTokens());
        assertEquals(0, breakdown.memoryRecallTokens());
        assertEquals(6, breakdown.ragContextTokens());
    }
}
