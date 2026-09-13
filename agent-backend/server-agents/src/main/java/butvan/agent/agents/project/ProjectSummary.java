package butvan.agent.agents.project;

import java.time.Instant;

/** 提供给项目列表与会话绑定使用的项目摘要。 */
public record ProjectSummary(
        String id,
        String name,
        String rootPath,
        Instant importedAt,
        ProjectAvailability availability
) {
}
