package butvan.agent.network.controller;

import butvan.agent.agents.subagent.SubagentTaskService;
import butvan.agent.network.annotation.ApiLog;
import io.agentscope.harness.agent.subagent.task.BackgroundTask;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final SubagentTaskService subagentTaskService;

    @GetMapping
    @ApiLog("查询会话的后台子 Agent 任务列表")
    public List<Map<String, Object>> list(
            @RequestParam String userId, @RequestParam String sessionId) {
        return subagentTaskService.list(userId, sessionId).stream()
                .map(this::toDto).toList();
    }

    @GetMapping("/{taskId}")
    @ApiLog("查询单个后台任务状态")
    public Map<String, Object> get(
            @RequestParam String userId, @RequestParam String sessionId,
            @PathVariable String taskId) {
        BackgroundTask task = subagentTaskService.get(userId, sessionId, taskId);
        return task == null ? Map.of("error", "task not found") : toDto(task);
    }

    @PostMapping("/{taskId}/cancel")
    @ApiLog("取消后台任务")
    public Map<String, Object> cancel(
            @RequestParam String userId, @RequestParam String sessionId,
            @PathVariable String taskId) {
        boolean ok = subagentTaskService.cancel(userId, sessionId, taskId);
        return Map.of("cancelled", ok);
    }

    private Map<String, Object> toDto(BackgroundTask task) {
        return Map.of(
                "taskId", task.getTaskId(),
                "status", String.valueOf(task.getTaskStatus()),
                "result", task.getResult() == null ? "" : task.getResult(),
                "error", task.getError() == null ? "" : task.getError());
    }
}