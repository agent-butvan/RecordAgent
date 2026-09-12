package butvan.agent.agents.tool;

import io.agentscope.core.tool.AgentTool;
import io.agentscope.core.tool.Toolkit;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Predicate;

/**
 * 将完整工具目录按能力域延迟暴露给模型，避免每次 Model Call 重复携带全部 Schema。
 *
 * <p>工具仍完整注册在 Toolkit 中；默认只暴露 AgentScope 的元工具，模型通过
 * {@code reset_equipped_tools} 为当前会话启用所需能力组。无法匹配的新增工具保持常驻，
 * 避免工具升级时因路由表尚未同步而静默丢失能力。</p>
 */
final class ToolSchemaRoutingPolicy {

    private static final String META_TOOL_NAME = "reset_equipped_tools";

    private static final List<GroupDefinition> GROUPS = List.of(
            group("workspace", "读写、搜索项目文件以及执行本地命令；代码和本机任务需要启用。",
                    names("read_file", "write_file", "edit_file", "list_files", "glob_files",
                            "grep_files", "execute", "custom_bash")),
            group("memory", "检索和保存长期记忆、搜索当前或历史会话。",
                    prefixes("memory_", "session_")),
            group("planning", "进入/维护计划模式，并在任务完成后生成验收报告。",
                    nameOrPrefix("acceptance_report", "plan_")),
            group("delegation", "创建、联系和等待子 Agent，以及管理异步任务。",
                    prefixes("agent_", "task_", "wait_async_")),
            group("skills", "按路径加载任务所需的 Skill 说明。",
                    prefixes("load_skill_")),
            group("web", "搜索互联网中的实时信息与外部资料。",
                    names("web_search")),
            group("calendar", "查询、创建、更新、完成或删除日程与待办。",
                    prefixes("calendar_")),
            group("finance", "查询财务数据、创建账户和记录收支。",
                    prefixes("finance_")),
            group("library", "搜索、读取、创建、更新或回收项目内部资料。",
                    prefixes("library_")),
            group("study", "查询、开始、结束、补录、更新或删除学习记录。",
                    prefixes("study_"))
    );

    private ToolSchemaRoutingPolicy() {}

    static void apply(Toolkit toolkit) {
        for (GroupDefinition group : GROUPS) {
            if (toolkit.getToolGroup(group.name()) == null) {
                toolkit.createToolGroup(group.name(), group.description(), false);
            }
        }

        for (String toolName : List.copyOf(toolkit.getToolNames())) {
            if (META_TOOL_NAME.equals(toolName)) continue;
            groupFor(toolName).ifPresent(group -> moveToGroup(toolkit, toolName, group.name()));
        }
        if (toolkit.getTool(META_TOOL_NAME) == null) {
            toolkit.registerMetaTool();
        }
    }

    private static Optional<GroupDefinition> groupFor(String toolName) {
        return GROUPS.stream().filter(group -> group.matches().test(toolName)).findFirst();
    }

    private static void moveToGroup(Toolkit toolkit, String toolName, String groupName) {
        AgentTool tool = toolkit.getTool(toolName);
        if (tool == null) return;
        toolkit.registration().agentTool(tool).group(groupName).apply();
    }

    private static GroupDefinition group(String name, String description, Predicate<String> matches) {
        return new GroupDefinition(name, description, matches);
    }

    private static Predicate<String> names(String... names) {
        Set<String> values = Set.of(names);
        return values::contains;
    }

    private static Predicate<String> prefixes(String... prefixes) {
        List<String> values = List.of(prefixes);
        return toolName -> values.stream().anyMatch(toolName::startsWith);
    }

    private static Predicate<String> nameOrPrefix(String name, String prefix) {
        return toolName -> name.equals(toolName) || toolName.startsWith(prefix);
    }

    private record GroupDefinition(String name, String description, Predicate<String> matches) {}
}
