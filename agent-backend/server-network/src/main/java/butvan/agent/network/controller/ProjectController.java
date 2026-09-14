package butvan.agent.network.controller;

import butvan.agent.agents.project.ProjectLifecycleService;
import butvan.agent.network.annotation.ApiLog;
import butvan.agent.network.common.Result;
import butvan.agent.network.dto.project.ImportProjectRequest;
import butvan.agent.network.dto.project.ProjectResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 本机项目引用的 HTTP 协议适配器。 */
@RestController
@RequestMapping("/agent/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectLifecycleService projectLifecycleService;

    @ApiLog("获取已导入项目列表")
    @GetMapping
    public Result<List<ProjectResponse>> listProjects() {
        return Result.success(projectLifecycleService.listProjects().stream()
                .map(ProjectResponse::from)
                .toList());
    }

    @ApiLog("导入本地项目目录")
    @PostMapping("/import")
    public Result<ProjectResponse> importProject(@RequestBody ImportProjectRequest request) {
        if (request == null) throw new IllegalArgumentException("导入项目请求不能为空");
        return Result.success(ProjectResponse.from(
                projectLifecycleService.importProject(request.name(), request.rootPath())
        ));
    }

    @ApiLog("从应用移除项目引用")
    @DeleteMapping("/{projectId}")
    public Result<Void> removeProject(@PathVariable String projectId) {
        projectLifecycleService.removeProject(projectId);
        return Result.success(null);
    }
}
