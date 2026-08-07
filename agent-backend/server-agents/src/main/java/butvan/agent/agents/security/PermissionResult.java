package butvan.agent.agents.security;

/**
 * 权限拦截校验结果封装对象。
 *
 * @param decision 校验决策（ALLOW 放行，DENY 拒绝，ASK 需用户确认）
 * @param reason   拦截或调用的具体原因说明
 */
public record PermissionResult(
        PermissionMode.Decision decision,
        String reason
) {

    /**
     * 构建无说明的放行结果。
     *
     * @return 放行 PermissionResult
     */
    public static PermissionResult allow() {
        return new PermissionResult(PermissionMode.Decision.ALLOW, "Operation allowed");
    }

    /**
     * 构建无说明的需要确认结果。
     *
     * @return 确认 PermissionResult
     */
    public static PermissionResult ask() {
        return new PermissionResult(PermissionMode.Decision.ASK, "User confirmation required");
    }

    /**
     * 构建带原因说明的需要确认结果。
     *
     * @param reason 原因描述
     * @return 确认 PermissionResult
     */
    public static PermissionResult ask(String reason) {
        return new PermissionResult(PermissionMode.Decision.ASK, reason);
    }

    /**
     * 构建带拒接原因说明的拒绝结果。
     *
     * @param reason 拒绝的防线与详细原因
     * @return 拒绝 PermissionResult
     */
    public static PermissionResult deny(String reason) {
        return new PermissionResult(PermissionMode.Decision.DENY, reason);
    }
}
