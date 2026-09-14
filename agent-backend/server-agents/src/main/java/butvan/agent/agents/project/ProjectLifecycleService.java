package butvan.agent.agents.project;

import butvan.agent.agents.session.SessionCatalogService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/** 协调项目登记与关联会话生命周期。 */
@Service
@RequiredArgsConstructor
public class ProjectLifecycleService {

    private final ProjectRegistry projectRegistry;
    private final SessionCatalogService sessionCatalogService;

    /** 校验并登记目录引用。 */
    public ProjectSummary importProject(String name, String rootPath) {
        return projectRegistry.importProject(name, rootPath);
    }

    /** 返回当前用户的项目摘要。 */
    public List<ProjectSummary> listProjects() {
        return projectRegistry.listProjects();
    }

    /** 移除目录引用并保留、解绑历史会话。 */
    public void removeProject(String projectId) {
        projectRegistry.get(projectId);
        sessionCatalogService.detachProject(projectId);
        projectRegistry.remove(projectId);
    }
}
