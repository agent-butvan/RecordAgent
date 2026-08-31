package butvan.agent.network.service.account;

/**
 * SMTP 邮件发送配置，对应 {@code ~/.butvan-agent/config.json} 中的 mail 节点。
 *
 * @param host     SMTP 服务器地址
 * @param port     SMTP 端口
 * @param username 发信账号
 * @param password 发信账号 SMTP 授权码
 * @param from     发件人地址
 * @param auth     是否启用 SMTP 认证
 * @param starttls 是否启用 STARTTLS
 */
public record SmtpMailConfigData(
        String host,
        int port,
        String username,
        String password,
        String from,
        boolean auth,
        boolean starttls) {

    /** 未配置或读取失败时返回的默认值。 */
    public static SmtpMailConfigData unset() {
        return new SmtpMailConfigData("", 587, "", "", "", true, true);
    }

    /** 是否具备发送条件（服务器地址与发件人齐全）。 */
    public boolean isReady() {
        return host != null && !host.isBlank()
                && from != null && !from.isBlank();
    }
}
