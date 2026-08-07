package butvan.agent.agents.tool.impl;

import io.agentscope.core.tool.Tool;
import io.agentscope.core.tool.ToolParam;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * 原生 AgentScope 文件写入工具。
 */
public class WriteFileTool {

    @Tool(description = "Write full text content to a file, automatically creating parent directories if needed.")
    public String writeFile(
            @ToolParam(name = "path", description = "Target file path to write to") String path,
            @ToolParam(name = "content", description = "Complete content text to write") String content
    ) {
        if (path == null || content == null) {
            return "Error: Parameters 'path' and 'content' are required.";
        }

        try {
            Path filePath = Paths.get(path);
            if (filePath.getParent() != null) {
                Files.createDirectories(filePath.getParent());
            }

            Files.writeString(filePath, content, StandardCharsets.UTF_8);
            return "Success: Wrote " + content.getBytes(StandardCharsets.UTF_8).length + " bytes to " + path;
        } catch (Exception e) {
            return "Error writing file: " + e.getMessage();
        }
    }
}