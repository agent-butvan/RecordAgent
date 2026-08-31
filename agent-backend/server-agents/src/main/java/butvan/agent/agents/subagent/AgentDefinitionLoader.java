package butvan.agent.agents.subagent;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import io.agentscope.harness.agent.subagent.SubagentDeclaration;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

/**
 * 读取应用层 Agent 定义，转换为 harness 声明。
 *
 * <p>支持两种目录：项目级 {@code {project}/.butvan-agent/agents/} 与用户级
 * {@code ~/.butvan-agent/agents/}。frontmatter 字段：</p>
 *
 * <pre>
 * name: explore
 * description: ...
 * model: (可选，未注册 ModelRegistry 时会被忽略并回落父模型)
 * maxTurns: 30
 * disallowedTools: [write_file, edit_file]   # 黑名单；与 tools 互斥
 * tools: [read_file, grep_files]             # 白名单；二选一
 * background: true                           # 应用层扩展
 * isolation: worktree                        # 应用层扩展：worktree | 空
 * ---
 * 正文 = 系统提示
 * </pre>
 */
@Component
public class AgentDefinitionLoader {

    private static final ObjectMapper YAML = new ObjectMapper(new YAMLFactory());

    /**
     * 内置 Agent 定义（代码常量，优先级最低，可被目录定义覆盖
     * @param allToolNames
     * @return
     */
    public List<ButvanSubagentSpec> loadBuiltins(List<String> allToolNames) {
        List<ButvanSubagentSpec> specs = new ArrayList<>();
        specs.add(build(
                "general-purpose", "通用子 Agent，拥有完整工具集",
                200, List.of(), null, false, null,
                """
                你是 Butvan 的 Agent。根据用户的消息，使用可用工具完成任务。
                把任务做完，不要过度设计，但也不要做一半就停。
                完成后用简洁报告回复：做了什么、关键发现。
                """,
                allToolNames));
        specs.add(build(
                "explore", "只读代码探索 Agent",
                30, List.of("write_file", "edit_file"), null, false, null,
                """
                你是一个文件搜索专家。这是一个只读探索任务。
                严禁：创建文件、修改文件、删除文件、执行任何改变系统状态的命令。
                优先并行发起多个搜索工具调用，高效完成搜索请求，清晰报告发现。
                """,
                allToolNames));
        specs.add(build(
                "plan", "软件架构与规划 Agent",
                15, List.of("write_file", "edit_file"), null, false, null,
                """
                你是一个软件架构师和规划专家。这是一个只读规划任务。
                严禁：创建文件、修改文件、删除文件。
                工作流程：理解需求 → 探索代码库 → 设计方案 → 输出分步实现策略。
                回复末尾必须列出 3-5 个对实现最关键的文件路径。
                """,
                allToolNames));

        return specs;
    }

    /** 读取一个目录下所有 .md 定义（非递归）。 */
    public List<ButvanSubagentSpec> loadDir(Path dir, List<String> allToolNames) {
        if (dir == null || !Files.isDirectory(dir)) {
            return List.of();
        }
        List<ButvanSubagentSpec> specs = new ArrayList<>();
        try (Stream<Path> paths = Files.list(dir)) {
            paths.filter(p -> p.getFileName().toString().endsWith(".md"))
                    .sorted()
                    .forEach(p -> {
                        try {
                            ButvanSubagentSpec spec = parseFile(p, allToolNames);
                            if (spec != null) specs.add(spec);
                        } catch (IOException e) {
                            throw new IllegalStateException("读取 Agent 定义失败: " + p, e);
                        }
                    });
        } catch (IOException e) {
            throw new IllegalStateException("扫描 Agent 定义目录失败: " + dir, e);
        }
        return specs;
    }

    private ButvanSubagentSpec parseFile(Path path, List<String> allToolNames) throws IOException {
        String content = Files.readString(path);
        if (content == null || !content.strip().startsWith("---")) {
            return null;
        }
        int end = content.indexOf("---", 3);
        if (end < 0) {
            return null;
        }
        Map<?, ?> fm = YAML.readValue(content.substring(3, end).strip(), Map.class);
        if (fm == null || fm.isEmpty()) {
            return null;
        }
        String name = asString(fm.get("name"));
        String description = asString(fm.get("description"));
        if (name == null || description == null) {
            throw new IllegalArgumentException("Agent 定义缺少 name/description: " + path);
        }
        int maxTurns = fm.get("maxTurns") instanceof Number n ? n.intValue() : 0;
        List<String> disallowed = stringList(fm.get("disallowedTools"));
        List<String> tools = stringList(fm.get("tools"));
        boolean background = Boolean.TRUE.equals(fm.get("background"));
        String isolation = asString(fm.get("isolation"));
        String body = content.substring(end + 3).strip();
        return build(name, description, maxTurns, disallowed, tools, background, isolation,
                body, allToolNames);
    }

    /**
     * 统一构造：白名单/黑名单二选一，黑名单转换为“全集 - 黑名单”
     * @param name
     * @param description
     * @param maxTurns
     * @param disallowed
     * @param tools
     * @param background
     * @param isolation
     * @param body
     * @return
     */
    private ButvanSubagentSpec build(
            String name, String description, int maxTurns,
            List<String> disallowed, List<String> tools,
            boolean background, String isolation, String body,
            List<String> allToolNames
    ) {
        List<String> effectiveTools;
        if (tools != null && !tools.isEmpty()) {
            effectiveTools = tools;
        } else if (disallowed != null && !disallowed.isEmpty()) {
            Set<String> denied = Set.copyOf(disallowed);
            effectiveTools = allToolNames.stream()
                    .filter(n -> !denied.contains(n))
                    .toList();
        } else {
            effectiveTools = null; // 继承全部
        }

        SubagentDeclaration decl = SubagentDeclaration.builder()
                .name(name)
                .description(description)
                .steps(maxTurns > 0 ? maxTurns : 200)
                .tools(effectiveTools)
                .inlineAgentsBody(body)
                .build();

        return new ButvanSubagentSpec(decl, background, isolation);
    }

    private static String asString(Object v) {
        return v == null ? null : v.toString().trim();
    }

    private static List<String> stringList(Object v) {
        if (v instanceof List<?> list) {
            return list.stream().filter(String.class::isInstance)
                    .map(String.class::cast).toList();
        }
        return List.of();
    }
}
