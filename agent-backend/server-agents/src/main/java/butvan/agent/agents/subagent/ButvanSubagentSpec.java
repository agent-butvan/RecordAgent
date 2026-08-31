package butvan.agent.agents.subagent;

import io.agentscope.harness.agent.subagent.SubagentDeclaration;

/**
 * 应用层子 Agent 规格 = harness 声明 + 两个扩展字段。
 *
 * @param declaration 转换后的 harness 声明（含 tools 白名单）
 * @param background  是否为后台 Agent（默认 false）
 * @param isolation   null 表示目录隔离；"worktree" 表示 Git Worktree 隔离
 */
public record ButvanSubagentSpec(
        SubagentDeclaration declaration,
        boolean background,
        String isolation
) {
    public String name() {
        return declaration.getName();
    }
}
