package butvan.agent.network.automation.dto;
/** 邮件配置传输对象；查询只返回凭据是否存在，不能回显密码。 */
public final class TaskMailDtos {
    private TaskMailDtos() {}
    public record Settings(String host, int port, String username, String from, boolean auth,
            boolean starttls, boolean hasPassword, boolean enabled, String maskedRecipient, boolean ready) {}
    public record Save(String host, int port, String username, String from, boolean auth,
            boolean starttls, String password, boolean enabled) {}
}
