package butvan.agent.agents.agent;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Agent 对话流在业务层和网络层之间传递的标准事件。
 *
 * <p>业务层只负责产生此事件，Controller 再将其转换为 SSE，避免 AgentScope 与 Spring Web
 * 相互耦合。</p>
 */
public sealed interface AgentStreamEvent permits
        AgentStreamEvent.Completed,
        AgentStreamEvent.Failed,
        AgentStreamEvent.TextDelta,
        AgentStreamEvent.ToolCall,
        AgentStreamEvent.ToolResult
{

    Logger log = LoggerFactory.getLogger(AgentStreamEvent.class);

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
            return content;
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
     * 工具调用发起事件
     * @param toolName
     */
    record ToolCall(String toolName) implements AgentStreamEvent{

        @Override
        public String eventName() {
            return "tool_call";
        }

        @Override
        public Object payload() {
            log.info("发起工具调用，工具名称：[ {} ]",toolName);
            return toolName;
        }
    }

    /**
     * 工具调用结果
     * @param delta
     */
    record ToolResult(String delta) implements AgentStreamEvent {

        @Override
        public String eventName() {
            return "tool_result";
        }

        @Override
        public Object payload() {
            return delta;
        }
    }
}
