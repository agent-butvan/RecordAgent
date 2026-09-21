package butvan.agent.network.dto.account;

import lombok.AllArgsConstructor;
import lombok.Data;

/** 返回给桌面端的账户状态，不包含密码哈希或其他敏感字段。 */
@Data
@AllArgsConstructor
public class AccountStatusResponse {
    private boolean bound;
    private String maskedEmail;
    private boolean emailNotificationsEnabled;
    private String avatarVersion;
}
