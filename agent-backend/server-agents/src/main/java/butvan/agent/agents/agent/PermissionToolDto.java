package butvan.agent.agents.agent;

import io.agentscope.core.message.ToolUseBlock;

import java.util.Map;

/**
 * 发送给前端的单挑待确认工具说明
 */
public record PermissionToolDto(
        String toolCallId,
        String toolName,
        Map<String, Object> input,
        String riskDescription,
        int index,
        int total
) {

    /**
     * 将框架工具调用转换为前端DTO
     * @param tool
     * @param index
     * @param total
     * @return
     */
    public static PermissionToolDto from(ToolUseBlock tool, int index, int total) {
        return new PermissionToolDto(
                tool.getId(), tool.getName(), tool.getInput(),
                riskDescription(tool.getName()), index, total
        );
    }

    private static String riskDescription(String toolName) {
        return switch (toolName) {
            case "write_file", "edit_file" -> "将修改本地文件内容";
            case "execute" -> "将在本地 Shell 中执行命令";
            case "http_request" -> "将向外部网络发送请求";
            case "plan_exit" -> "将提交任务计划书，等待你审核批准后开始执行";
            default -> "改工具属于需要确认的高风险操作";
        };
    }
}
