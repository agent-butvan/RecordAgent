package butvan.agent.agents.prompts;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PromptBuilderTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void defaultPromptIncludesOnDemandContextRulesInPriorityOrder() {
        String prompt = buildDefaultPrompt();

        assertTrue(prompt.contains("# 工作区上下文按需加载"));
        assertTrue(prompt.contains("memory_search"));
        assertTrue(prompt.contains("AGENTS.md"));
        assertTrue(prompt.indexOf("# 系统运行规则")
                < prompt.indexOf("# 工作区上下文按需加载"));
        assertTrue(prompt.indexOf("# 工作区上下文按需加载")
                < prompt.indexOf("# 任务执行规范"));
    }

    @Test
    void defaultPromptDoesNotDuplicateToneStyleSection() {
        assertEquals(1, occurrences(buildDefaultPrompt(), "# 语气与格式"));
    }

    private String buildDefaultPrompt() {
        return PromptBuilder.buildDefaultSystemPrompt("test-model", temporaryDirectory.toString());
    }

    private int occurrences(String text, String target) {
        int count = 0;
        int offset = 0;
        while ((offset = text.indexOf(target, offset)) >= 0) {
            count++;
            offset += target.length();
        }
        return count;
    }
}
