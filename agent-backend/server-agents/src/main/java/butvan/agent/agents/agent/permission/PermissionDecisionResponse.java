package butvan.agent.agents.agent.permission;

/**
 * 权限决定保存后的结果；旧单条接口可返回下一条，批量接口完成后直接允许恢复。
 */
public record PermissionDecisionResponse(
        boolean readyToResume,
        PermissionToolDto nextTool
) {

    /**
     * 返回一个尚未处理的下一条工具
     * @param tool
     * @return
     */
    public static PermissionDecisionResponse next(PermissionToolDto tool) {
        return new PermissionDecisionResponse(false, tool);
    }

    /**
     * 本批工具已逐条决定完毕，可以调用 resume 接口
     * @return
     */
    public static PermissionDecisionResponse ready() {
        return new PermissionDecisionResponse(true, null);
    }
}
