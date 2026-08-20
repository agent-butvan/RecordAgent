package butvan.agent.agents.agent;

import io.agentscope.core.event.ConfirmResult;
import io.agentscope.core.message.ToolUseBlock;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 一次 Permission Ask 产生的一批待审核的工具
 */
public final class PendingApproval {

    private final String approvalId = UUID.randomUUID().toString();
    private final AgentRun run;
    private final List<ToolUseBlock> tools;
    private final Map<String, Decision> decisions = new LinkedHashMap<>();
    private final Instant expiresAt = Instant.now().plusSeconds(600);

    public PendingApproval(AgentRun run, List<ToolUseBlock> tools) {
        this.run = run;
        this.tools = tools;
    }

    public String approvalId() { return approvalId; }
    public AgentRun run() { return run; }
    public boolean expired() { return Instant.now().isAfter(expiresAt); }


    /**
     * 直接受当前批次中尚未决定的工具，防止重复提交或篡改 callId
     * @param toolCallId
     * @param approved
     */
    public synchronized void decide(String toolCallId, boolean approved) {
        boolean exists = tools.stream().anyMatch(tool -> tool.getId().equals(toolCallId));
        if (!exists || decisions.containsKey(toolCallId)) {
            throw new IllegalArgumentException("待确认工具不存在或已经处理");
        }
        decisions.put(toolCallId, new Decision(approved));
    }

    public synchronized PermissionToolDto nextTool() {
        for (int i = 0; i < tools.size(); i++) {
            ToolUseBlock tool = tools.get(i);
            if (!decisions.containsKey(tool.getId())) {
                return PermissionToolDto.from(tool, i + 1, tools.size());
            }
        }
        return null;
    }

    public synchronized boolean allDecided() {
        return decisions.size() == tools.size();
    }

    /**
     * 自动批准本批次全部待确认工具。
     *
     * <p>仅供已显式授权的全权限渠道（如仅限本人使用的飞书机器人）调用，
     * 调用方必须确认该渠道可信且风险可控。</p>
     */
    public synchronized void approveAll() {
        for (ToolUseBlock tool : tools) {
            decisions.putIfAbsent(tool.getId(), new Decision(true));
        }
    }

    /** 当前批次待确认工具数量。 */
    public synchronized int toolCount() {
        return tools.size();
    }

    /**
     * 只有全部决定后才构造恢复 AgentScope 的 ConfirmResult 列表
     * @return
     */
    public synchronized List<ConfirmResult> toConfirmResult() {
        if (!allDecided()) {
            throw new IllegalArgumentException("仍有工具尚未确认");
        }
        return tools.stream()
                .map(tool -> new ConfirmResult(
                        decisions.get(tool.getId()).approved(), tool
                )).toList();
    }

    /** 只有全部决定后才构造恢复 AgentScope 的 ConfirmResult 列表。 */
    public synchronized List<ConfirmResult> toConfirmResults() {
        if (!allDecided()) {
            throw new IllegalStateException("仍有工具尚未确认");
        }
        return tools.stream()
                .map(tool -> new ConfirmResult(decisions.get(tool.getId()).approved(), tool))
                .toList();
    }

    public ToolUseBlock findTool(String toolCallId) {
        return tools.stream()
                .filter(tool -> tool.getId().equals(toolCallId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("待确认工具不存在"));
    }




    private record Decision(boolean approved){}
}
