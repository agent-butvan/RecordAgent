package butvan.agent.network.agenttool.common;

import butvan.agent.agents.tool.result.ToolResult;

/** 将现有领域异常收敛为 Agent 可稳定处理的错误码。 */
public final class BusinessToolErrors {
    private BusinessToolErrors() {
    }

    public static ToolResult<Void> from(RuntimeException exception) {
        String message = exception.getMessage() == null || exception.getMessage().isBlank()
                ? "工具执行失败"
                : exception.getMessage();
        if (message.contains("已被修改") || message.contains("已被其他操作修改")) {
            return ToolResult.failure("VERSION_CONFLICT", message);
        }
        if (message.contains("余额不足")) return ToolResult.failure("INSUFFICIENT_BALANCE", message);
        if (message.contains("正在进行") || message.contains("进行中")) {
            return ToolResult.failure("ACTIVE_SESSION_EXISTS", message);
        }
        if (message.contains("重叠")) return ToolResult.failure("TIME_RANGE_OVERLAP", message);
        if (message.contains("不存在")) return ToolResult.failure("NOT_FOUND", message);
        if (exception instanceof IllegalArgumentException) return ToolResult.failure("INVALID_ARGUMENT", message);
        return ToolResult.failure("BUSINESS_RULE_VIOLATION", message);
    }
}
