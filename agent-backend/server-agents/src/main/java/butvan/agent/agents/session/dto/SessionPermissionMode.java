package butvan.agent.agents.session.dto;

/** 用户可选择的会话级工具权限模式。 */
public enum SessionPermissionMode {
    /** 所有未被明确允许的操作都请求用户批准。 */
    ASK,
    /** 自动允许安全读取与工作区编辑，高风险操作仍请求批准。 */
    AUTO_EDIT,
    /** 在框架硬性安全检查之后自动允许其余操作。 */
    FULL_ACCESS
}
