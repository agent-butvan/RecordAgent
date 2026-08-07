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
 * 原生 AgentScope 终端命令执行工具。
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