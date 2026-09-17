package butvan.agent.network.study.event;

/**
 * 学习时段事务内产生的状态变更事件；实时推送层只会在事务成功提交后消费。
 *
 * @param ownerId 用户标识
 * @param sessionId 发生变化的学习时段标识
 * @param changeType 变更类型
 */
public record StudySessionChangedEvent(String ownerId, String sessionId, ChangeType changeType) {

    /** 学习时段支持的持久化变更类型。 */
    public enum ChangeType {
        STARTED,
        FINISHED,
        CREATED,
        UPDATED,
        DELETED
    }
}
