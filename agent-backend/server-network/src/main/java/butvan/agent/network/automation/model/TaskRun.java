package butvan.agent.network.automation.model;

/** 一次执行的内容与各渠道状态，确认状态不由系统通知是否被关闭推断。 */
public record TaskRun(String id, String taskId, String ownerId, String title, String content,
        long plannedAt, long createdAt, String source, String status, String desktopStatus,
        String emailStatus, String recipient, String confirmation, boolean sound, String error) {}
