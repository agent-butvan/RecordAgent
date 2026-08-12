package butvan.agent.agents.session.dto;

/** 会话生命周期状态。 */
public enum SessionStatus {
    /** 可以读取、发送消息和编辑标题。 */
    ACTIVE,
    /** 正在取消流并清理数据，拒绝新的消息请求。 */
    DELETING
}