package butvan.agent.network.dto.account;

import lombok.Data;

/** 绑定本机账户请求。密码仅用于服务端计算哈希，绝不持久化明文。 */
@Data
public class BindEmailRequest {
    private String email;
    private String password;
    private String verificationCode;
}
