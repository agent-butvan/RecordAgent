package butvan.agent.agents.security;

import java.util.regex.Pattern;

/**
 * 代表一条解析后的 YAML 权限规则。
 * <p>
 * 规则语法格式为：{@code ToolName(pattern)}，例如 {@code Bash(git *)} 或 {@code ReadFile(*.env*)}。
 *
 * @param toolName 目标工具名称（如 Bash, ReadFile 等）
 * @param pattern  内容匹配通配符表达式（支持 * 与 ?）
 * @param effect   匹配成功后的处理策略（ALLOW, DENY, 或 ASK）
 */
public record PermissionRule(
        String toolName,
        String pattern,
        PermissionMode.Decision effect
) {

    /**
     * 判断当前规则是否匹配给定的工具名称与输入内容。
     *
     * @param targetToolName 正在调用的工具名称
     * @param content        提取出的工具输入参数（如 Bash 命令字符串或文件路径）
     * @return 若工具名相同且内容符合通配符模式，返回 {@code true}
     */
    public boolean matches(String targetToolName, String content) {
        if (targetToolName == null || content == null) {
            return false;
        }
        if (!this.toolName.equalsIgnoreCase(targetToolName)) {
            return false;
        }
        return globMatch(this.pattern, content);
    }

    /**
     * 将带有 * 和 ? 的 Simple Glob 表达式转换为正则表达式进行正则匹配。
     *
     * @param globPattern 通配符表达式
     * @param input       待校验的文本
     * @return 匹配成功返回 {@code true}
     */
    private static boolean globMatch(String globPattern, String input) {
        if (globPattern == null || input == null) {
            return false;
        }
        String regex = "^" + Pattern.quote(globPattern)
                .replace("*", "\\E.*\\Q")
                .replace("?", "\\E.\\Q") + "$";
        regex = regex.replace("\\Q\\E", "");

        try {
            return Pattern.compile(regex, Pattern.CASE_INSENSITIVE).matcher(input).matches();
        } catch (Exception e) {
            return input.equalsIgnoreCase(globPattern);
        }
    }
}
