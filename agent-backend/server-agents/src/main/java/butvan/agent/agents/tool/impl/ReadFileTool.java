package butvan.agent.agents.tool.impl;

import io.agentscope.core.tool.Tool;
import io.agentscope.core.tool.ToolParam;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

/**
 * 原生 AgentScope 文件高效读取工具。
 */
public class ReadFileTool {

    @Tool(description = "Read file contents with line numbers and optional line offset and limit.")
    public String readFile(
            @ToolParam(name = "path", description = "Absolute or relative path to the target file") String path,
            @ToolParam(name = "offset", description = "Line offset to start reading from (1-indexed, default 1)") Integer offset,
            @ToolParam(name = "limit", description = "Maximum lines to read (default 500)") Integer limit
    ) {
        if (path == null || path.isBlank()) {
            return "Error: Path parameter is required.";
        }

        try {
            Path filePath = Paths.get(path);
            if (!Files.exists(filePath)) {
                return "Error: File not found at path " + path;
            }

            List<String> lines = Files.readAllLines(filePath);
            int startOffset = (offset != null && offset > 0) ? offset - 1 : 0;
            int maxLimit = (limit != null && limit > 0) ? limit : 500;
            int end = Math.min(lines.size(), startOffset + maxLimit);

            StringBuilder result = new StringBuilder();
            for (int i = startOffset; i < end; i++) {
                result.append(String.format("%4d | %s\n", i + 1, lines.get(i)));
            }

            return result.toString();
        } catch (Exception e) {
            return "Error reading file: " + e.getMessage();
        }
    }
}