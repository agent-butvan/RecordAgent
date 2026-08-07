package butvan.agent.agents.tool.impl;

import io.agentscope.core.tool.Tool;
import io.agentscope.core.tool.ToolParam;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.List;

/**
 * 原生 AgentScope Glob 文件路径通配符搜索工具。
 */
public class GlobTool {

    @Tool(description = "Find file paths matching a glob pattern (e.g. '**/*.java').")
    public String globFiles(
            @ToolParam(name = "pattern", description = "Glob pattern string") String pattern,
            @ToolParam(name = "dir", description = "Base directory to search from (optional)") String dir
    ) {
        if (pattern == null || pattern.isBlank()) {
            return "Error: Pattern parameter is required.";
        }

        String baseDir = (dir != null && !dir.isBlank()) ? dir : System.getProperty("user.dir");
        Path rootDir = Paths.get(baseDir);

        try {
            PathMatcher matcher = FileSystems.getDefault().getPathMatcher("glob:" + pattern);
            List<String> matchedFiles = new ArrayList<>();

            Files.walkFileTree(rootDir, new SimpleFileVisitor<Path>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                    if (matcher.matches(rootDir.relativize(file)) || matcher.matches(file.getFileName())) {
                        matchedFiles.add(file.toString());
                    }
                    return FileVisitResult.CONTINUE;
                }
            });

            return String.join("\n", matchedFiles);
        } catch (IOException e) {
            return "Error searching glob files: " + e.getMessage();
        }
    }
}