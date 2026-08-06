# AgentScope Java 原生自定义工具系统设计与接入教程

## 1. 这份文档解决什么问题

为了给 `ButvanAgent` 打造强大且标准的本地桌面操控能力，我们需要在后端定义一套高质量的工具集（例如：Shell 命令行执行、高效文件读取、文件精准编辑、Glob 文件匹配与 Grep 正则搜索）。

**核心原则**：
1. **完全基于 AgentScope 官方原生 Tool 机制**：使用 AgentScope 标准的 `io.agentscope.core.tool.Tool` 注解、`io.agentscope.core.tool.ToolParam` 参数注解，以及 `Toolkit` 工具容器。
2. **复用 mewcode-java 优秀的核心实现逻辑**：吸收 `mewcode-java` 项目在 ProcessBuilder 交互、POSIX 权限、分页防乱码、精准 Target-Replacement 文本替换及 NIO FileVisitor 检索上的优良设计。

这份教程旨在一步步指导你手动编写并装配基于 AgentScope 官方原生规范的自定义工具体系。

---

## 2. AgentScope 官方 Tool 核心原理

在 AgentScope Java 框架中，工具系统的运作主要由以下三大组件驱动：

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        io.agentscope.core.tool                         │
├────────────────────────────────┬───────────────────────────────────────┤
│           组件 / 注解           │                 作用                   │
├────────────────────────────────┼───────────────────────────────────────┤
│ @Tool                          │ 标注在类的方法上，声明该方法为一个 Agent 可调用的工具   │
│ @ToolParam                     │ 标注在方法的参数上，提供 LLM 识别的参数名与功能描述    │
│ Toolkit                        │ 工具注册与管理容器，负责生成 JSON Schema 并派发调用     │
└────────────────────────────────┴───────────────────────────────────────┘
```

**工作流**：
```text
创建标注 @Tool 方法的 Java 工具类 
    ↓
注册到 AgentScope Toolkit: toolkit.registerTool(new MyTool())
    ↓
装配给 HarnessAgent: HarnessAgent.builder().toolkit(toolkit).build()
    ↓
AgentScope 自动提取方法签名并转化为 JSON Schema，大模型通过函数调用 (Function Calling) 触发该方法
```

---

## 3. 包结构与目录规划

在后端 `agent-backend/server-agents` 模块的 `src/main/java/butvan/agent/agents/` 路径下规划工具包结构：

```text
butvan.agent.agents.tool/
├── ToolRegistry.java            // 工具注册与 Toolkit 统一管理类
└── impl/                        // 基于 AgentScope 原生 @Tool 的核心工具类实现
    ├── BashTool.java            // 终端 Shell 命令工具
    ├── ReadFileTool.java        // 高效文件读取工具 (支持分页/行号)
    ├── WriteFileTool.java       // 文件全量写入/创建工具
    ├── EditFileTool.java        // 文件精准局部替换/编辑工具
    ├── GlobTool.java            // 通配符文件查找工具
    └── GrepTool.java            // 正则表达式文本搜索工具
```

---

## 4. 第一步：编写 Bash 终端工具 (`BashTool.java`)

在 `butvan.agent.agents.tool.impl` 包下创建 `BashTool.java`。

使用 AgentScope 的 `@Tool` 标注方法，使用 `@ToolParam` 标注 `command` 参数，并**加入防止 ProcessBuilder 死锁与交互等待的防卡死逻辑**：

```java
package butvan.agent.agents.tool.impl;

import io.agentscope.core.tool.Tool;
import io.agentscope.core.tool.ToolParam;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * 原生 AgentScope 终端命令执行工具（防卡死版）。
 */
public class BashTool {

    private final String workDir;

    public BashTool() {
        this.workDir = System.getProperty("user.dir");
    }

    public BashTool(String workDir) {
        this.workDir = workDir != null ? workDir : System.getProperty("user.dir");
    }

    @Tool(name = "custom_bash", description = "用于在 Shell 环境中执行终端命令，可查看系统硬件、电池状态、内存、磁盘空间及代码任务等。")
    public String execute(
            @ToolParam(name = "command", description = "要执行的终端 Shell 指令") String command
    ) {
        if (command == null || command.isBlank()) {
            return "Error: Command parameter cannot be empty.";
        }

        try {
            ProcessBuilder processBuilder = new ProcessBuilder("sh", "-c", command);
            processBuilder.directory(new File(workDir));
            processBuilder.redirectErrorStream(true);

            Process process = processBuilder.start();
            
            // 防卡死关键 1：主动关闭 stdin 标准输入流，防止子进程因交互性命令卡死等待用户输入
            process.getOutputStream().close();

            // 防卡死关键 2：异步线程读取标准输出流，防止缓冲区满导致父子线程死锁
            CompletableFuture<String> outputFuture = CompletableFuture.supplyAsync(() -> {
                StringBuilder output = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        output.append(line).append("\n");
                    }
                } catch (Exception ignored) {}
                return output.toString();
            });

            // 防卡死关键 3：设置 15 秒合理超时限制（避免长卡 120 秒）
            boolean finished = process.waitFor(15, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                return "Error: Command execution timed out (15s limit).";
            }

            String result = outputFuture.get(3, TimeUnit.SECONDS);
            int exitCode = process.exitValue();
            if (exitCode != 0) {
                return "Error (exit code " + exitCode + "):\n" + result;
            }

            return result.isBlank() ? "Command executed successfully with no output." : result;
        } catch (Exception e) {
            return "Error: Failed to execute bash command: " + e.getMessage();
        }
    }
}
```


---

## 5. 第二步：编写文件读取工具 (`ReadFileTool.java`)

在 `butvan.agent.agents.tool.impl` 包下创建 `ReadFileTool.java`：

```java
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
```

---

## 6. 第三步：编写文件覆盖写入工具 (`WriteFileTool.java`)

在 `butvan.agent.agents.tool.impl` 包下创建 `WriteFileTool.java`：

```java
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
```

---

## 7. 第四步：编写文件精准编辑工具 (`EditFileTool.java`)

在 `butvan.agent.agents.tool.impl` 包下创建 `EditFileTool.java`：

```java
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
```

---

## 8. 第五步：编写匹配与搜索工具 (`GlobTool.java` & `GrepTool.java`)

### 8.1 `GlobTool.java`

```java
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
```

### 8.2 `GrepTool.java`

```java
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
```

---

## 9. 第六步：编写 `ToolRegistry` 并装配至 AgentScope `Toolkit`

创建 `butvan.agent.agents.tool.ToolRegistry`：

```java
package butvan.agent.agents.tool;

import butvan.agent.agents.tool.impl.*;
import io.agentscope.core.tool.Toolkit;
import org.springframework.stereotype.Component;

/**
 * 工具管理与 AgentScope Toolkit 统一注册中心。
 */
@Component
public class ToolRegistry {

    private final Toolkit toolkit;

    public ToolRegistry() {
        this.toolkit = new Toolkit();
        
        // 向 AgentScope Toolkit 注册所有的原生 @Tool 工具类组件
        this.toolkit.registerTool(new BashTool());
        this.toolkit.registerTool(new ReadFileTool());
        this.toolkit.registerTool(new WriteFileTool());
        this.toolkit.registerTool(new EditFileTool());
        this.toolkit.registerTool(new GlobTool());
        this.toolkit.registerTool(new GrepTool());
    }

    /**
     * 获取配置好的 AgentScope Toolkit 容器
     */
    public Toolkit getToolkit() {
        return this.toolkit;
    }
}
```

### 在 `AgentService.java` 中注入与装配

更新 [`AgentService.java`](file:///Users/butvan/Butvan_Projets/my_code/ButvanAgent/agent-backend/server-agents/src/main/java/butvan/agent/agents/agent/AgentService.java)：

```java
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentService {

    private final ModelHolder modelHolder;
    private final ToolRegistry toolRegistry; // 注入工具注册中心

    private HarnessAgent createHarnessAgent(Model model) {
        return HarnessAgent.builder()
                .name("butvan-agent")
                .sysPrompt("你是一个强大的桌面智能助手，善于使用 Bash 和文件工具定位与修改代码问题。")
                .model(model)
                .toolkit(toolRegistry.getToolkit()) // 注入全局注册的 AgentScope Toolkit
                .workspace(Paths.get(".agentscope/workspace"))
                .compaction(CompactionConfig.builder()
                        .triggerMessages(30)
                        .keepMessages(10)
                        .build())
                .build();
    }
}
```

---

## 10. 建议的实施顺序与验证方式

| 次序 | 手动编写的代码内容 | 位置 | 成功验证标志 |
| --- | --- | --- | --- |
| 1 | 编写 `BashTool.java` | `tool/impl/BashTool.java` | `@Tool` 方法编译通过，参数全带 `@ToolParam`。 |
| 2 | 编写 `ReadFileTool.java` & `WriteFileTool.java` | `tool/impl/` | 校验路径及 Line range 参数处理。 |
| 3 | 编写 `EditFileTool.java` | `tool/impl/` | 校验 target 替换。 |
| 4 | 编写 `GlobTool.java` & `GrepTool.java` | `tool/impl/` | 校验 Java FileVisitor 与正则逻辑。 |
| 5 | 创建 `ToolRegistry.java` | `tool/ToolRegistry.java` | `new Toolkit()` 并成功调用 `registerTool(...)`。 |
| 6 | 在 `AgentService` 注入 `ToolRegistry` | `agent/AgentService.java` | 启动后端应用，查看控制台日志输出了相关 Tool 的注册信息。 |

---

## 11. 最终代码职责表

| 类名 | 归属规范 | 职责与作用 |
| --- | --- | --- |
| `BashTool` | AgentScope `@Tool` | 基于 `ProcessBuilder` 执行安全 Shell 指令。 |
| `ReadFileTool` | AgentScope `@Tool` | 分页、行号化读取文本文件。 |
| `WriteFileTool` | AgentScope `@Tool` | 自动补全目录并写全量文件。 |
| `EditFileTool` | AgentScope `@Tool` | 精准替换文件局部内容。 |
| `GlobTool` / `GrepTool` | AgentScope `@Tool` | 高效的 Glob 检索与文本正则搜寻。 |
| `ToolRegistry` | AgentScope `Toolkit` | 管理工具组件，生成 JSON Schema 传递给 `HarnessAgent`。 |
