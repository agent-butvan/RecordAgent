package butvan.agent.agents.security;

/**
 * 权限控制模式枚举。
 * <p>
 * 定义智能体在不同安全场景下的整体信任等级与默认决策矩阵：
 * <ul>
 *   <li>{@link #DEFAULT}: 默认安全模式。只读工具自动放行，写操作与命令执行需要用户审批。</li>
 *   <li>{@link #ACCEPT_EDITS}: 编辑信任模式。只读与文件写入/编辑工具自动放行，仅 Shell 命令需要用户审批。</li>
 *   <li>{@link #PLAN}: 架构规划模式。仅允许安全只读与规划相关工具，写操作与命令需要审批。</li>
 *   <li>{@link #BYPASS}: 跳过审批模式。全放行（注意：第1层危险命令与第2层沙箱硬防线依然生效）。</li>
 * </ul>
 */
public enum PermissionMode {

    /** 默认安全模式：只读放行，写/命令行需确认 */
    DEFAULT,

    /** 自动接受编辑：只读/写放行，命令行需确认 */
    ACCEPT_EDITS,

    /** 规划模式：仅规划与只读放行 */
    PLAN,

    /** 完全放行模式（仅限受控 CI/CD 环境） */
    BYPASS;

    /**
     * 权限检查的三态决策输出。
     */
    public enum Decision {
        /** 放行执行 */
        ALLOW,
        /** 硬性拦截 */
        DENY,
        /** 需要人在回路 (HITL) 弹窗审批 */
        ASK
    }

    /**
     * 工具的类别划分，用于模式矩阵决策。
     */
    public enum ToolCategory {
        /** 只读类型工具（如 ReadFile, Glob, Grep） */
        READ_ONLY,
        /** 文件写入与编辑工具（如 WriteFile, EditFile） */
        WRITE_FILE,
        /** Shell/Bash 终端命令工具 */
        COMMAND
    }

    /**
     * 根据当前权限模式与工具类别，返回默认的权限决策。
     *
     * @param category 工具分类
     * @return 默认决策 (ALLOW, DENY, 或 ASK)
     */
    public Decision decide(ToolCategory category) {
        if (this == BYPASS) {
            return Decision.ALLOW;
        }

        return switch (category) {
            case READ_ONLY -> Decision.ALLOW;
            case WRITE_FILE -> (this == ACCEPT_EDITS) ? Decision.ALLOW : Decision.ASK;
            case COMMAND -> Decision.ASK;
        };
    }
}
