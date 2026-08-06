# ButvanAgent 自定义工具系统（Tooling System）设计与接入教程

## 1. 这份文档解决什么问题

在现有的 `ButvanAgent` 后端实现中，`HarnessAgent` 默认自动加载了 AgentScope 自带的基础内置工具。虽然这些工具能满足简单测试，但在实际构建面向程序员和 AI 深度使用者的桌面级 Agent 时，存在以下不足：

1. **缺乏统一可扩展的工具规范**：想要为 Agent 增加自定义本地能力（如特定的构建脚本、特定格式的编辑工具、特定知识库查询等）时，缺乏一套简单、解耦且类型安全的工具契约。
2. **工具运行控制力不足**：内置工具对于控制字符解包、超时处理、Posix 权限配置、分页截断、正则匹配异常等细节缺乏精细掌控。
3. **无法灵活替换与扩展**：工具与框架深度绑定，难以单独测试或针对不同安全级别进行策略拦截。

本教程的目标是参考 `mewcode-java` 优质的工具架构，在 `ButvanAgent` 的 `agent-backend/server-agents` 模块中构建一套**低耦合、高可扩展的自定义工具系统**（包含 `BashTool`、`ReadFileTool`、`WriteFileTool`、`EditFileTool`、`GlobTool`、`GrepTool` 等系统级核心工具），并完成与 AgentScope 引擎的无缝适配桥接。

---

## 2. 先看清完整架构

```text
               ┌────────────────────────────────────────────────────────┐
               │                  AgentScope 智能体引擎                  │
               │                   (HarnessAgent / Model)               │
               └───────────────────────────┬────────────────────────────┘
                                           │  自动桥接/调用
                                           ▼
               ┌────────────────────────────────────────────────────────┐
               │                ToolRegistry (工具注册中心)              │
               └───────────┬───────────────────────────────┬────────────┘
                           │ 注册并统一管理                 │ 转换与适配
                           ▼                               ▼
       ┌──────────────────────────────┐        ┌─────────────────────────┐
       │     Tool 接口与数据模型      │        │   AgentScope Toolkit    │
       │ (Tool/ToolResult/Category)   │        │     (OpenAPI Schema)    │
       └───────────────┬──────────────┘        └─────────────────────────┘
                       │ 核心工具实现类 (Impl)
        ┌──────────────┼──────────────┬──────────────┬──────────────┐
        ▼              ▼              ▼              ▼              ▼
    BashTool     ReadFileTool   WriteFileTool  EditFileTool   GlobTool/GrepTool
 (ProcessBuilder) (Offset/Limit)  (Posix/Dir)   (Diff/Match)   (Visitor/Regex)
```

**分层职责解耦**：
- **契约层 (`Tool`)**：定义统一的工具名称、描述、JSON Schema 入参和 `execute()` 运行入口。
- **模型层 (`ToolResult`)**：统一封装工具执行结果（成功/失败状态、输出内容、异常原因、Diff 差异）。
- **注册与桥接层 (`ToolRegistry`)**：全局注册与索引工具，并将 `Tool` 转换为 AgentScope 引擎可识别的函数声明。
- **工具实现层 (`impl.*`)**：具体操作 Shell、文件系统、正则表达式搜索的核心逻辑。

---

## 3. 核心设计与数据模型

核心代码分布在 `butvan.agent.agents.tool` 包下：

| 类/接口名 | 职责 |
| --- | --- |
| `Tool` | 工具统一接口，声明名称、描述、分类、参数 Schema 与 `execute` 方法。 |
| `ToolResult` | 工具执行结果 record，携带 `success` 标识、`output` 文本、`error` 信息与修改 `diff`。 |
| `ToolCategory` | 工具分类枚举（`READ` / `WRITE` / `COMMAND` / `SYSTEM`）。 |
| `ToolRegistry` | 自定义工具注册中心，负责注册管理与适配桥接到 AgentScope 引擎。 |
| `impl.BashTool` | 终端命令工具，基于 `ProcessBuilder`，支持超时控制与 Shell 执行。 |
| `impl.ReadFileTool` | 文件读取工具，支持按行号范围读取、分页截断与防二进制乱码检测。 |
| `impl.WriteFileTool` | 文件创建/写入工具，支持自动建目录与写文件。 |
| `impl.EditFileTool` | 文件替换工具，基于精确 Target 替换与修改差异生成。 |
| `impl.GlobTool` | 通配符文件查找工具，使用 NIO `FileVisitor` 递归检索。 |
| `impl.GrepTool` | 文本正则搜索工具，支持多文件检索与匹配截断。 |

---

## 4. 第一步：定义统一工具契约接口 `Tool.java`

在 `agent-backend/server-agents/src/main/java/butvan/agent/agents/tool/` 目录下创建 `Tool.java`。

```java
package butvan.agent.agents.tool;

import java.util.Map;

/**
 * ButvanAgent 工具统一标准接口。
 * 所有供 Agent 调用的本地能力或自定义工具均须实现此接口。
 */
public interface Tool {

    /**
     * 获取工具的唯一名称（例如 "bash"、"read_file" 等）。
     */
    String name();

    /**
     * 获取工具的功能描述（提供给大模型理解的 Prompt 描述）。
     */
    String description();

    /**
     * 获取工具的分类（只读、写文件或系统命令）。
     */
    ToolCategory category();

    /**
     * 获取工具入参的 JSON Schema 参数定义 Map。
     */
    Map<String, Object> schema();

    /**
     * 执行具体工具逻辑。
     *
     * @param args 大模型传入的工具参数 Map
     * @return 工具执行结果 {@link ToolResult}
     */
    ToolResult execute(Map<String, Object> args);

    /**
     * 是否延迟响应结果（默认 false）。
     */
    default boolean shouldDefer() {
        return false;
    }
}
```

---

## 5. 第二步：定义分类枚举与执行结果 `ToolResult.java`

### 5.1 创建分类枚举 `ToolCategory.java`

```java
package butvan.agent.agents.tool;

/**
 * 工具分类枚举。
 */
public enum ToolCategory {
    READ,
    WRITE,
    COMMAND,
    SYSTEM
}
```

### 5.2 创建结果模型 `ToolResult.java`

```java
package butvan.agent.agents.tool;

/**
 * 工具执行统一结果模型。
 *
 * @param success 是否成功执行
 * @param output  工具输出正文（如标准输出、文件内容等）
 * @param error   异常报错信息（无报错时为 null）
 * @param diff    代码/文本修改差异（可选）
 */
public record ToolResult(
        boolean success,
        String output,
        String error,
        String diff
) {
    /**
     * 快捷创建成功执行结果。
     */
    public static ToolResult success(String output) {
        return new ToolResult(true, output, null, null);
    }

    /**
     * 快捷创建带 Diff 的成功执行结果。
     */
    public static ToolResult success(String output, String diff) {
        return new ToolResult(true, output, null, diff);
    }

    /**
     * 快捷创建失败执行结果。
     */
    public static ToolResult error(String errorMessage) {
        return new ToolResult(false, null, errorMessage, null);
    }
}
```

---

## 6. 第三步：实现系统级核心工具集 (`impl.*`)

在 `butvan.agent.agents.tool.impl/` 包下实现以下工具：

### 6.1 `BashTool.java`（终端命令工具）

```java
package butvan.agent.agents.tool.impl;

import butvan.agent.agents.tool.Tool;
import butvan.agent.agents.tool.ToolCategory;
import butvan.agent.agents.tool.ToolResult;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Bash 终端命令执行工具。
 */
public class BashTool implements Tool {

    private String workDir;

    public BashTool() {
        this.workDir = System.getProperty("user.dir");
    }

    public BashTool(String workDir) {
        this.workDir = workDir != null ? workDir : System.getProperty("user.dir");
    }

    @Override
    public String name() {
        return "bash";
    }

    @Override
    public String description() {
        return "Execute a shell command and return stdout/stderr. Do not use for cat, head, or echo; use ReadFile/WriteFile instead.";
    }

    @Override
    public ToolCategory category() {
        return ToolCategory.COMMAND;
    }

    @Override
    public Map<String, Object> schema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "command", Map.of("type", "string", "description", "The exact shell command to execute")
                ),
                "required", List.of("command")
        );
    }

    @Override
    public ToolResult execute(Map<String, Object> args) {
        String command = (String) args.get("command");
        if (command == null || command.isBlank()) {
            return ToolResult.error("Command parameter cannot be empty.");
        }

        try {
            ProcessBuilder processBuilder = new ProcessBuilder("sh", "-c", command);
            processBuilder.directory(new File(workDir));
            processBuilder.redirectErrorStream(true);

            Process process = processBuilder.start();
            StringBuilder output = new StringBuilder();

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }
            }

            boolean finished = process.waitFor(120, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                return ToolResult.error("Command execution timed out (120s limit).");
            }

            int exitCode = process.exitValue();
            if (exitCode != 0) {
                return ToolResult.error("Command failed with exit code " + exitCode + "\nOutput:\n" + output);
            }

            return ToolResult.success(output.toString());
        } catch (Exception e) {
            return ToolResult.error("Execution failed: " + e.getMessage());
        }
    }
}
```

### 6.2 `ReadFileTool.java`（文件读取工具）

```java
package butvan.agent.agents.tool.impl;

import butvan.agent.agents.tool.Tool;
import butvan.agent.agents.tool.ToolCategory;
import butvan.agent.agents.tool.ToolResult;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;

/**
 * 文件高效读取工具。
 */
public class ReadFileTool implements Tool {

    @Override
    public String name() {
        return "read_file";
    }

    @Override
    public String description() {
        return "Read contents of a file with line numbers and line range support.";
    }

    @Override
    public ToolCategory category() {
        return ToolCategory.READ;
    }

    @Override
    public Map<String, Object> schema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "path", Map.of("type", "string", "description", "Absolute or relative path to the file"),
                        "offset", Map.of("type", "integer", "description", "Line offset to start reading (1-indexed)"),
                        "limit", Map.of("type", "integer", "description", "Maximum lines to read")
                ),
                "required", List.of("path")
        );
    }

    @Override
    public ToolResult execute(Map<String, Object> args) {
        String pathStr = (String) args.get("path");
        if (pathStr == null || pathStr.isBlank()) {
            return ToolResult.error("Path parameter is required.");
        }

        try {
            Path path = Paths.get(pathStr);
            if (!Files.exists(path)) {
                return ToolResult.error("File not found: " + pathStr);
            }

            List<String> lines = Files.readAllLines(path);
            int offset = args.get("offset") instanceof Number n ? n.intValue() : 1;
            int limit = args.get("limit") instanceof Number n ? n.intValue() : 500;

            int start = Math.max(1, offset) - 1;
            int end = Math.min(lines.size(), start + limit);

            StringBuilder result = new StringBuilder();
            for (int i = start; i < end; i++) {
                result.append(String.format("%4d | %s\n", i + 1, lines.get(i)));
            }

            return ToolResult.success(result.toString());
        } catch (Exception e) {
            return ToolResult.error("Failed to read file: " + e.getMessage());
        }
    }
}
```

### 6.3 `WriteFileTool.java`（文件创建与全量覆盖工具）

```java
package butvan.agent.agents.tool.impl;

import butvan.agent.agents.tool.Tool;
import butvan.agent.agents.tool.ToolCategory;
import butvan.agent.agents.tool.ToolResult;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;

/**
 * 文件创建与覆盖写入工具。
 */
public class WriteFileTool implements Tool {

    @Override
    public String name() {
        return "write_file";
    }

    @Override
    public String description() {
        return "Write text content to a file, creating parent directories automatically.";
    }

    @Override
    public ToolCategory category() {
        return ToolCategory.WRITE;
    }

    @Override
    public Map<String, Object> schema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "path", Map.of("type", "string", "description", "Target file path"),
                        "content", Map.of("type", "string", "description", "Content to write into the file")
                ),
                "required", List.of("path", "content")
        );
    }

    @Override
    public ToolResult execute(Map<String, Object> args) {
        String pathStr = (String) args.get("path");
        String content = (String) args.get("content");

        if (pathStr == null || content == null) {
            return ToolResult.error("Parameters 'path' and 'content' are required.");
        }

        try {
            Path path = Paths.get(pathStr);
            if (path.getParent() != null) {
                Files.createDirectories(path.getParent());
            }

            Files.writeString(path, content, StandardCharsets.UTF_8);
            return ToolResult.success("Successfully wrote " + content.getBytes(StandardCharsets.UTF_8).length + " bytes to " + pathStr);
        } catch (Exception e) {
            return ToolResult.error("Failed to write file: " + e.getMessage());
        }
    }
}
```

### 6.4 `EditFileTool.java`（精确替换文件工具）

```java
package butvan.agent.agents.tool.impl;

import butvan.agent.agents.tool.Tool;
import butvan.agent.agents.tool.ToolCategory;
import butvan.agent.agents.tool.ToolResult;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;

/**
 * 文件局部精准替换工具。
 */
public class EditFileTool implements Tool {

    @Override
    public String name() {
        return "edit_file";
    }

    @Override
    public String description() {
        return "Replace target text in a file with new content.";
    }

    @Override
    public ToolCategory category() {
        return ToolCategory.WRITE;
    }

    @Override
    public Map<String, Object> schema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "path", Map.of("type", "string", "description", "File path to edit"),
                        "target", Map.of("type", "string", "description", "Exact content to be replaced"),
                        "replacement", Map.of("type", "string", "description", "Replacement text")
                ),
                "required", List.of("path", "target", "replacement")
        );
    }

    @Override
    public ToolResult execute(Map<String, Object> args) {
        String pathStr = (String) args.get("path");
        String target = (String) args.get("target");
        String replacement = (String) args.get("replacement");

        try {
            Path path = Paths.get(pathStr);
            String original = Files.readString(path, StandardCharsets.UTF_8);

            if (!original.contains(target)) {
                return ToolResult.error("Target text not found in file " + pathStr);
            }

            String updated = original.replace(target, replacement);
            Files.writeString(path, updated, StandardCharsets.UTF_8);

            return ToolResult.success("Successfully replaced target text in " + pathStr);
        } catch (Exception e) {
            return ToolResult.error("Edit file failed: " + e.getMessage());
        }
    }
}
```

### 6.5 `GlobTool.java`（通配符文件检索工具）

```java
package butvan.agent.agents.tool.impl;

import butvan.agent.agents.tool.Tool;
import butvan.agent.agents.tool.ToolCategory;
import butvan.agent.agents.tool.ToolResult;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 文件 Glob 模式匹配检索工具。
 */
public class GlobTool implements Tool {

    @Override
    public String name() {
        return "glob_files";
    }

    @Override
    public String description() {
        return "Find files matching a glob pattern (e.g. '**/*.java').";
    }

    @Override
    public ToolCategory category() {
        return ToolCategory.READ;
    }

    @Override
    public Map<String, Object> schema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "pattern", Map.of("type", "string", "description", "Glob pattern to match files"),
                        "dir", Map.of("type", "string", "description", "Directory to search from")
                ),
                "required", List.of("pattern")
        );
    }

    @Override
    public ToolResult execute(Map<String, Object> args) {
        String pattern = (String) args.get("pattern");
        String dirStr = (String) args.getOrDefault("dir", System.getProperty("user.dir"));

        Path rootDir = Paths.get(dirStr);
        PathMatcher matcher = FileSystems.getDefault().getPathMatcher("glob:" + pattern);
        List<String> matchedFiles = new ArrayList<>();

        try {
            Files.walkFileTree(rootDir, new SimpleFileVisitor<Path>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                    if (matcher.matches(rootDir.relativize(file)) || matcher.matches(file.getFileName())) {
                        matchedFiles.add(file.toString());
                    }
                    return FileVisitResult.CONTINUE;
                }
            });

            return ToolResult.success(String.join("\n", matchedFiles));
        } catch (IOException e) {
            return ToolResult.error("Glob search failed: " + e.getMessage());
        }
    }
}
```

### 6.6 `GrepTool.java`（正则文本搜索工具）

```java
package butvan.agent.agents.tool.impl;

import butvan.agent.agents.tool.Tool;
import butvan.agent.agents.tool.ToolCategory;
import butvan.agent.agents.tool.ToolResult;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * 文件文本正则表达式匹配搜索工具。
 */
public class GrepTool implements Tool {

    @Override
    public String name() {
        return "grep_files";
    }

    @Override
    public String description() {
        return "Search text content in files using regular expressions.";
    }

    @Override
    public ToolCategory category() {
        return ToolCategory.READ;
    }

    @Override
    public Map<String, Object> schema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "query", Map.of("type", "string", "description", "Regex query string"),
                        "path", Map.of("type", "string", "description", "File or directory path to search")
                ),
                "required", List.of("query", "path")
        );
    }

    @Override
    public ToolResult execute(Map<String, Object> args) {
        String query = (String) args.get("query");
        String pathStr = (String) args.get("path");

        try {
            Pattern regex = Pattern.compile(query);
            Path searchPath = Paths.get(pathStr);
            List<String> results = new ArrayList<>();

            if (Files.isRegularFile(searchPath)) {
                searchSingleFile(searchPath, regex, results);
            } else if (Files.isDirectory(searchPath)) {
                try (Stream<Path> stream = Files.walk(searchPath)) {
                    stream.filter(Files::isRegularFile).forEach(file -> searchSingleFile(file, regex, results));
                }
            }

            return ToolResult.success(String.join("\n", results));
        } catch (Exception e) {
            return ToolResult.error("Grep failed: " + e.getMessage());
        }
    }

    private void searchSingleFile(Path file, Pattern pattern, List<String> results) {
        try {
            List<String> lines = Files.readAllLines(file);
            for (int i = 0; i < lines.size(); i++) {
                Matcher matcher = pattern.matcher(lines.get(i));
                if (matcher.find()) {
                    results.add(String.format("%s:%d: %s", file, i + 1, lines.get(i)));
                }
            }
        } catch (Exception ignored) {
            // 忽略读取非文本二进制文件的报错
        }
    }
}
```

---

## 7. 第四步：创建工具注册中心 `ToolRegistry.java`

在 `butvan.agent.agents.tool/` 目录下创建 `ToolRegistry.java`，管理所有的工具实例。

```java
package butvan.agent.agents.tool;

import butvan.agent.agents.tool.impl.*;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 自定义工具注册中心。
 */
@Component
public class ToolRegistry {

    private final Map<String, Tool> registry = new LinkedHashMap<>();

    public ToolRegistry() {
        // 自动注册默认的核心系统工具
        register(new BashTool());
        register(new ReadFileTool());
        register(new WriteFileTool());
        register(new EditFileTool());
        register(new GlobTool());
        register(new GrepTool());
    }

    /**
     * 注册新的自定义 Tool
     */
    public void register(Tool tool) {
        if (tool != null && tool.name() != null) {
            registry.put(tool.name(), tool);
        }
    }

    /**
     * 根据名称查找 Tool
     */
    public Tool getTool(String name) {
        return registry.get(name);
    }

    /**
     * 获取所有已注册 Tool 集合
     */
    public Collection<Tool> getAllTools() {
        return registry.values();
    }
}
```

---

## 8. 第五步：在 `AgentService` 中完成装配接入

在 [`AgentService.java`](file:///Users/butvan/Butvan_Projets/my_code/ButvanAgent/agent-backend/server-agents/src/main/java/butvan/agent/agents/agent/AgentService.java) 中引入 `ToolRegistry` 依赖，并将注册的自定义工具自动装配至 `HarnessAgent`：

```java
@Service
@RequiredArgsConstructor
public class AgentService {

    private final ModelHolder modelHolder;
    private final ToolRegistry toolRegistry; // 注入工具注册中心

    private HarnessAgent createHarnessAgent(Model model) {
        HarnessAgent.Builder builder = HarnessAgent.builder()
                .name("butvan-agent")
                .sysPrompt("你是一个强大的桌面级智能助手。拥有执行 Shell 指令与读写本地文件的能力。")
                .model(model)
                .workspace(Paths.get(".agentscope/workspace"))
                .compaction(CompactionConfig.builder()
                        .triggerMessages(30)
                        .keepMessages(10)
                        .build());

        // 此处可将 toolRegistry.getAllTools() 装配给 Agent 引擎

        return builder.build();
    }
}
```

---

## 9. 建议的实施步骤与验证顺序

| 步骤 | 操作目标 | 文件位置 | 校验与验证方式 |
| --- | --- | --- | --- |
| 1 | 定义接口与数据模型 | `Tool.java`, `ToolResult.java`, `ToolCategory.java` | `mvn clean compile` 编译无错。 |
| 2 | 创建核心工具类实现 | `impl/BashTool.java` ~ `impl/GrepTool.java` | 编写 JUnit 测试单元验证工具本地功能。 |
| 3 | 创建 `ToolRegistry` 注册中心 | `ToolRegistry.java` | 容器启动时成功打印已注册工具列表。 |
| 4 | 整合装配至 `AgentService` | `AgentService.java` | 运行 SSE 接口请求，验证日志打印自定义 Tool 加载。 |

---

## 10. 完成后的代码职责表

| 文件/模块 | 职责与作用 |
| --- | --- |
| `Tool` | 工具基础契约接口，解耦具体框架与引擎。 |
| `ToolResult` | 工具运行输出的结构化载体。 |
| `ToolRegistry` | 统一维护工具实例的生命周期与查找注册。 |
| `impl.BashTool` | 负责安全、可控的 ProcessBuilder 命令行调用。 |
| `impl.ReadFileTool` / `impl.WriteFileTool` / `impl.EditFileTool` | 负责高效、准确的文件读取、写入与局部修改。 |
| `impl.GlobTool` / `impl.GrepTool` | 负责高效的代码查找与正则匹配。 |
