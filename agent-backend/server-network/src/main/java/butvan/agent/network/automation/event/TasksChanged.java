package butvan.agent.network.automation.event;
/** 任务事务成功后刷新该用户的实时快照。 */
public record TasksChanged(String ownerId) {}
