package butvan.agent.network.dto.account;

import lombok.Data;

/** 发送邮箱验证码请求。 */
@Data
public class SendVerificationCodeRequest {
    private String email;
}
