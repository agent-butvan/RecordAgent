package butvan.agent.network.dto.project;

/** 导入本地项目目录请求。 */
public record ImportProjectRequest(String name, String rootPath) {
}
