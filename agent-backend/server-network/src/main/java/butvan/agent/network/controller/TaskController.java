package butvan.agent.network.controller;

import butvan.agent.agents.subagent.SubagentTaskService;
import butvan.agent.network.annotation.ApiLog;
import butvan.agent.network.dto.SubagentTaskResponse;
import butvan.agent.network.service.task.SubagentTaskStreamService;
import io.agentscope.harness.agent.subagent.task.BackgroundTask;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final SubagentTaskService subagentTaskService;
    private final SubagentTaskStreamService subagentTaskStreamService;

    @GetMapping
    @ApiLog("查询会话的后台子 Agent 任务列表")
    public List<SubagentTaskResponse> list(
            @RequestParam String userId, @RequestParam String sessionId) {
        return subagentTaskService.list(userId, sessionId).stream()
                .map(this::toDto).toList();
    }

    /**
     * 订阅当前会话的后台任务变更；连接建立时会先推送一份完整快照。
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @ApiLog("订阅会话的后台子 Agent 任务变更")
    public SseEmitter stream(@RequestParam String userId, @RequestParam String sessionId) {
        return subagentTaskStreamService.subscribe(userId, sessionId, list(userId, sessionId));
    }

    @GetMapping("/{taskId}")
    @ApiLog("查询单个后台任务状态")
    public SubagentTaskResponse get(
            @RequestParam String userId, @RequestParam String sessionId,
            @PathVariable String taskId) {
        BackgroundTask task = subagentTaskService.get(userId, sessionId, taskId);
        return task == null ? new SubagentTaskResponse(taskId, "NOT_FOUND", "", "task not found") : toDto(task);
    }

    @PostMapping("/{taskId}/cancel")
    @ApiLog("取消后台任务")
    public Map<String, Object> cancel(
            @RequestParam String userId, @RequestParam String sessionId,
            @PathVariable String taskId) {
        boolean ok = subagentTaskService.cancel(userId, sessionId, taskId);
        return Map.of("cancelled", ok);
    }

    private SubagentTaskResponse toDto(BackgroundTask task) {
        return new SubagentTaskResponse(
                task.getTaskId(),
                String.valueOf(task.getTaskStatus()),
                task.getResult() == null ? "" : task.getResult(),
                task.getError() == null || task.getError().getMessage() == null
                        ? "" : task.getError().getMessage());
    }
}
