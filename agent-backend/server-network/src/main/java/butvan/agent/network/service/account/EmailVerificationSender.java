package butvan.agent.network.service.account;

/** 向用户发送一次性邮箱验证码的基础设施接口。 */
public interface EmailVerificationSender {
    void send(String email, String verificationCode);
}
