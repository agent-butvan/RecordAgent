package butvan.agent.agents.tool.impl;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.agentscope.core.tool.Tool;
import io.agentscope.core.tool.ToolParam;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 验收报告工具
 */
@Component
public class AcceptanceReportTool {


    /**
     * 提交验收自检结果并生成 markdown 验收报告。
     *
     * <p>返回的文本会作为工具结果注入模型上下文，模型随后以
     * 「## 验收报告」开头的 markdown 呈现给用户。</p>
     */
    @Tool(name = "acceptance_report", description = "任务全部执行完成后调用：逐条自检任务完成情况并生成验证报告。未完成的项目必须如实标记，严禁虚报")
    public String submit(
            @ToolParam(name = "verdict", description = "总体结论，只能是：全部完成 / 部分完成 / 未完成") String verdict,
            @ToolParam(name = "items", description = "逐项验收结果列表，每项包含内容、状态、证据") List<ReportItem> items
    ) {
        // 基础校验
        if (verdict == null || verdict.isBlank() || items == null || items.isEmpty()) {
            return "Error: 验收报告必须包含 verdict 和至少一项 items";
        }

        // 逐项渲染成固定结果的 markdown
        StringBuilder sb = new StringBuilder();
        sb.append("## 验收报告\n\n");
        sb.append("**总体结论: ").append(verdict).append("**\n\n");
        for (int i = 0; i < items.size(); i++) {
            ReportItem item = items.get(i);
            sb.append(i + 1).append(". ").append(marker(item.status()))
                    .append(' ').append(item.content()).append("\n");
            // 证据可选：有就带上，方便用户核对
            if (item.evidence() != null && !item.evidence().isBlank()) {
                sb.append("    证据: ").append(item.evidence()).append("\n");
            }
        }

        return sb.toString();
    }

    /**
     * 把状态翻译成用户可见的标记
     * @param status
     * @return
     */
    private String marker(String status) {
        if ("completed".equals(status)) return "已完成";
        if ("partial".equals(status)) return "部分完成";
        return "未完成";
    }



    /**
     * 单条验收项。
     *
     * <p>故意使用与框架内置 TodoTools.TodoItem 相同的写法
     * （静态类 + @JsonCreator + @JsonProperty），保证 AgentScope
     * 的 JSON Schema 生成与参数反序列化行为一致。</p>
     */
    private static final class ReportItem {
        private final String content;
        private final String status;
        private final String evidence;

        @JsonCreator
        public ReportItem(
                @JsonProperty("content") String content,
                @JsonProperty("status") String status,
                @JsonProperty("evidence") String evidence
        ) {
            this.content = content;
            this.status = status;
            this.evidence = evidence;
        }

        @JsonProperty("content")
        public String content() {
            return content;
        }

        @JsonProperty("status")
        public String status() {
            return status;
        }

        @JsonProperty("evidence")
        public String evidence() {
            return evidence;
        }
    }
}
