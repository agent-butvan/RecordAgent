package butvan.agent.agents.session.dto;

/** 当前首版只允许修改标题，避免客户端修改 ownerId、状态和时间等受保护字段。 */
public record UpdateSessionRequest(String title) {
}