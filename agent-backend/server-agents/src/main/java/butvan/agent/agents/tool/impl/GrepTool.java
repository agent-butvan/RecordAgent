package butvan.agent.agents.tool.impl;

import io.agentscope.core.tool.Tool;
import io.agentscope.core.tool.ToolParam;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * 原生 AgentScope 文本正则搜索工具。
 */
public class GrepTool {

    @Tool(description = "Search text content across files using regular expressions.")
    public String grepFiles(
            @ToolParam(name = "query", description = "Regular expression query") String query,
            @ToolParam(name = "path", description = "File or directory path to search in") String path
    ) {
        if (query == null || path == null) {
            return "Error: Parameters 'query' and 'path' are required.";
        }

        try {
            Pattern regex = Pattern.compile(query);
            Path searchPath = Paths.get(path);
            List<String> results = new ArrayList<>();

            if (Files.isRegularFile(searchPath)) {
                searchFileContent(searchPath, regex, results);
            } else if (Files.isDirectory(searchPath)) {
                try (Stream<Path> stream = Files.walk(searchPath)) {
                    stream.filter(Files::isRegularFile).forEach(file -> searchFileContent(file, regex, results));
                }
            }

            return String.join("\n", results);
        } catch (Exception e) {
            return "Error running grep: " + e.getMessage();
        }
    }

    private void searchFileContent(Path file, Pattern pattern, List<String> results) {
        try {
            List<String> lines = Files.readAllLines(file);
            for (int i = 0; i < lines.size(); i++) {
                Matcher matcher = pattern.matcher(lines.get(i));
                if (matcher.find()) {
                    results.add(String.format("%s:%d: %s", file, i + 1, lines.get(i)));
                }
            }
        } catch (Exception ignored) {
            // 忽略读取二进制非文本文件的报错
        }
    }
}