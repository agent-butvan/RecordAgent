package butvan.agent.network.dto.project;

import butvan.agent.agents.project.ProjectSummary;

import java.time.Instant;

/** 桌面端侧边栏使用的项目摘要。 */
public record ProjectResponse(
        String id,
        String name,
        String rootPath,
        Instant importedAt,
        String availability
) {
    /** 将内部项目摘要转换为稳定的 HTTP 响应。 */
    public static ProjectResponse from(ProjectSummary summary) {
        return new ProjectResponse(
                summary.id(),
                summary.name(),
                summary.rootPath(),
                summary.importedAt(),
                summary.availability().name()
        );
    }
}
