package butvan.agent.agents.tool.impl;

import io.agentscope.core.tool.Tool;
import io.agentscope.core.tool.ToolParam;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * 原生 AgentScope 精准局部文本替换编辑工具。
 */
public class EditFileTool {

    @Tool(description = "Replace specific target text block with replacement text in a target file.")
    public String editFile(
            @ToolParam(name = "path", description = "Target file path to edit") String path,
            @ToolParam(name = "target", description = "Exact original text block to be replaced") String target,
            @ToolParam(name = "replacement", description = "New text content to insert") String replacement
    ) {
        if (path == null || target == null || replacement == null) {
            return "Error: 'path', 'target' and 'replacement' parameters are required.";
        }

        try {
            Path filePath = Paths.get(path);
            String original = Files.readString(filePath, StandardCharsets.UTF_8);

            if (!original.contains(target)) {
                return "Error: Target text not found in " + path;
            }

            String updated = original.replace(target, replacement);
            Files.writeString(filePath, updated, StandardCharsets.UTF_8);

            return "Success: Replaced target text in " + path;
        } catch (Exception e) {
            return "Error editing file: " + e.getMessage();
        }
    }
}
