package butvan.agent.agents.agent;

import butvan.agent.agents.session.dto.TranscriptMessageDto;
import io.agentscope.core.agent.RuntimeContext;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 一次尚未完成的用户会和，只在服务进程内存活
 */
public class AgentRun {

    private final String sessionId;
    private final String userId;
    private final String turnId;
    private final RuntimeContext runtimeContext;
    private final Instant startedAt;
    private final StringBuilder content = new StringBuilder();
    private final StringBuilder thinking = new StringBuilder();
    // 初始 SSE 与恢复 SSE 共用同一份工具参数和执行记录
    private final Map<String, StringBuilder> toolArgsBuffer = new ConcurrentHashMap<>();
    private final Map<String, TranscriptMessageDto.ToolExecutionDto> toolExecutions = new LinkedHashMap<>();

    public AgentRun(String sessionId, String userId, String turnId, RuntimeContext runtimeContext) {
        this.sessionId = sessionId;
        this.userId = userId;
        this.turnId = turnId;
        this.runtimeContext = runtimeContext;
        this.startedAt = Instant.now();
    }

    // 下面 getter 仅暴露恢复和最终落库需要的数据。
    public String sessionId() { return sessionId; }
    public String userId() { return userId; }
    public String turnId() { return turnId; }
    public RuntimeContext runtimeContext() { return runtimeContext; }
    public Instant startedAt() { return startedAt; }
    public StringBuilder content() { return content; }
    public StringBuilder thinking() { return thinking; }
    public Map<String, StringBuilder> toolArgsBuffer() { return toolArgsBuffer; }
    public Map<String, TranscriptMessageDto.ToolExecutionDto> toolExecutions() {
        return toolExecutions;
    }


}
