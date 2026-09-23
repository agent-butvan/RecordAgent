package butvan.agent.agents.agent.event;

import butvan.agent.agents.agent.permission.PermissionToolDto;

import java.util.Map;
import java.util.List;

/**
 * Agent 对话流在业务层和网络层之间传递的标准事件。
 *
 * <p>业务层只负责产生此事件，Controller 再将其转换为 SSE，避免 AgentScope 与 Spring Web
 * 相互耦合。</p>
 */
public sealed interface AgentStreamEvent permits AgentStreamEvent.RunStarted, AgentStreamEvent.Completed, AgentStreamEvent.Cancelled, AgentStreamEvent.Failed, AgentStreamEvent.PermissionRequired, AgentStreamEvent.RoutingNotice, AgentStreamEvent.SubagentProgress, AgentStreamEvent.TextDelta, AgentStreamEvent.ThinkingDelta, AgentStreamEvent.ToolCall, AgentStreamEvent.ToolResult
{

    /**
     * 事件名称
     * @return SSE 事件名称
     */
    String eventName();

    /**
     * 获取 SSE 数据内容。
     *
     * @return SSE 数据内容
     */
    Object payload();

    default boolean isTerminal() {
        return false;
    }

    /** 后端已接管并注册这次运行。 */
    record RunStarted(String runId) implements AgentStreamEvent {
        @Override
        public String eventName() {
            return "run_started";
        }

        @Override
        public Object payload() {
            return Map.of("runId", runId != null ? runId : "");
        }
    }

    /**
     * 模型正文文本增量。
     *
     * @param content 本次新增的文本片段
     */
    record TextDelta(String content) implements AgentStreamEvent {

        @Override
        public String eventName() {
            return "text";
        }

        @Override
        public Object payload() {
            return content == null ? "" : content;
        }
    }

    /**
     * 模型返回 thinking 文本增量
     * @param content
     */
    record ThinkingDelta(String content) implements AgentStreamEvent {

        @Override
        public String eventName() {
            return "thinking";
        }

        @Override
        public Object payload() {
            return content == null ? "" : content;
        }
    }

    /**
     * Agent 正常完成事件。
     */
    record Completed() implements AgentStreamEvent {

        @Override
        public String eventName() {
            return "done";
        }

        @Override
        public Object payload() {
            return "";
        }

        @Override
        public boolean isTerminal() {
            return true;
        }
    }

    /** 用户显式停止或传输断开后，已完成持久化收尾。 */
    record Cancelled(String runId) implements AgentStreamEvent {
        @Override
        public String eventName() {
            return "cancelled";
        }

        @Override
        public Object payload() {
            return Map.of("runId", runId != null ? runId : "", "status", "CANCELLED");
        }

        @Override
        public boolean isTerminal() {
            return true;
        }
    }

    /**
     * Agent 失败事件。
     *
     * @param message 可安全展示给用户的错误信息
     */
    record Failed(String message) implements AgentStreamEvent {
        @Override
        public String eventName() {
            return "error";
        }

        @Override
        public Object payload() {
            return message;
        }

        @Override
        public boolean isTerminal() {
            return true;
        }
    }

    /**
     * 可恢复的工具路由提示；该事件不会结束 SSE，也不会把 assistant 标记为失败。
     *
     * @param code 稳定错误码
     * @param message 可直接展示的脱敏中文提示
     * @param requestId 外部服务请求 ID；可能为空
     * @param retryable 是否属于可重试错误
     * @param retryAfterMillis 服务端建议等待毫秒数；未提供时为空
     */
    record RoutingNotice(
            String code,
            String message,
            String requestId,
            boolean retryable,
            Long retryAfterMillis
    ) implements AgentStreamEvent {
        @Override
        public String eventName() {
            return "routing_notice";
        }

        @Override
        public Object payload() {
            Map<String, Object> data = new java.util.LinkedHashMap<>();
            data.put("code", code == null ? "unknown" : code);
            data.put("message", message == null ? "Jev 暂不可用，已自动降级。" : message);
            data.put("requestId", requestId == null ? "" : requestId);
            data.put("retryable", retryable);
            data.put("retryAfterMillis", retryAfterMillis);
            return data;
        }
    }

    /**
     * 工具调用发起事件
     * @param toolCallId
     * @param toolName
     * @param command
     */
    record ToolCall(String toolCallId,String toolName, String command ) implements AgentStreamEvent{

        @Override
        public String eventName() {
            return "tool_call";
        }

        @Override
        public Object payload() {
            return Map.of(
                    "toolCallId", toolCallId != null ? toolCallId : "",
                    "toolName", toolName != null ? toolName : "",
                    "command", command != null ? command : ""
            );
        }
    }

    /**
     * 工具调用结果
     * @param toolCallId
     * @param toolName
     * @param result 本次新增的工具输出片段；终态事件可以为空
     * @param status 当前工具执行状态
     */
    record ToolResult(
            String toolCallId,
            String toolName,
            String result,
            ToolStatus status
    ) implements AgentStreamEvent {

        /** 空状态兼容为 RUNNING，终态必须由 ToolResultEndEvent 明确覆盖。 */
        public ToolResult {
            status = status == null ? ToolStatus.RUNNING : status;
        }

        @Override
        public String eventName() {
            return "tool_result";
        }

        @Override
        public Object payload() {
            return Map.of(
                    "toolCallId", toolCallId != null ? toolCallId : "",
                    "toolName", toolName != null ? toolName : "",
                    "result", result != null ? result : "",
                    "status", status.payloadValue()
            );
        }
    }

    /** Tool Result 在业务 SSE 中使用的稳定状态。 */
    enum ToolStatus {
        RUNNING("running"),
        COMPLETED("completed"),
        FAILED("failed"),
        CANCELLED("cancelled");

        /** payloadValue：发送给前端的稳定小写状态值。 */
        private final String payloadValue;

        ToolStatus(String payloadValue) {
            this.payloadValue = payloadValue;
        }

        /** @return SSE payload 使用的小写状态值 */
        public String payloadValue() {
            return payloadValue;
        }
    }


    record PermissionRequired(
            String approvalId,
            String runId,
            String turnId,
            List<PermissionToolDto> tools
    ) implements AgentStreamEvent{

        @Override
        public String eventName() {
            return "permission_required";
        }

        @Override
        public Object payload() {
            return Map.of(
                    "approvalId", approvalId != null ? approvalId : "",
                    "runId", runId != null ? runId : "",
                    "turnId", turnId != null ? turnId : "",
                    "tools", tools != null ? tools : List.of()
            );
        }

        /** 结束当前 SSE；恢复会由前端建立新的 SSE 连接。 */
        @Override
        public boolean isTerminal() {
            return true;
        }
    }

    /**
     * 子 Agent 进度事件。
     *
     * @param source    事件源路径（如 main/explore），用于前端分组
     * @param agentId   子 Agent 类型名
     * @param eventType 子事件类型（start / text / tool / end）
     * @param content   文本增量或工具名等
     */
    record SubagentProgress(String source, String agentId, String eventType, String content)
            implements AgentStreamEvent {

        @Override
        public String eventName() {
            return "subagent";
        }

        @Override
        public Object payload() {
            return Map.of("source", source == null ? "" : source,
                    "agentId", agentId == null ? "" : agentId,
                    "eventType", eventType == null ? "" : eventType,
                    "content", content == null ? "" : content);
        }
    }
}
