package butvan.agent.network.automation.model;

/** 持久化任务定义；版本号仅随用户配置修改递增，运行计时不使编辑失效。 */
public record AutomationTask(String id, String ownerId, TaskSpec spec, String status,
        int version, Long nextAt, long activeSeconds, long updatedAt) {}
