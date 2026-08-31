package butvan.agent.network.service.account;

import butvan.agent.agents.config.LocalConfigService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;

import java.util.Properties;

/**
 * 基于 SMTP 的验证码邮件发送器。
 *
 * <p>SMTP 凭据只从 {@code ~/.butvan-agent/config.json} 的 mail 节点读取，
 * 不写入 yml、源码或日志。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SmtpEmailVerificationSender implements EmailVerificationSender {

    private final LocalConfigService localConfigService;
    private final ObjectMapper objectMapper;

    /** 读取本地 mail 配置并发送验证码；未配置时抛出可识别的服务不可用异常。 */
    @Override
    public void send(String email, String verificationCode) {
        SmtpMailConfigData config = loadConfig();
        if (!config.isReady()) {
            throw new IllegalStateException(
                    "邮件服务尚未配置，请在 ~/.butvan-agent/config.json 的 mail 节点填写 SMTP 配置");
        }
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(config.from());
        message.setTo(email);
        message.setSubject("ButvanAgent 邮箱验证");
        message.setText("你的 ButvanAgent 邮箱验证码是：" + verificationCode
                + "\n\n验证码将在 10 分钟后失效。若不是你本人操作，请忽略此邮件。");
        buildMailSender(config).send(message);
    }

    private SmtpMailConfigData loadConfig() {
        Object rawMail = localConfigService.loadFullConfigData().getExtraFields().get("mail");
        if (rawMail == null) {
            return SmtpMailConfigData.unset();
        }
        return objectMapper.convertValue(rawMail, SmtpMailConfigData.class);
    }

    /** 每次按最新配置构建发送器，桌面端修改 config.json 后无需重启即可生效。 */
    private JavaMailSenderImpl buildMailSender(SmtpMailConfigData config) {
        JavaMailSenderImpl mailSender = new JavaMailSenderImpl();
        mailSender.setHost(config.host());
        mailSender.setPort(config.port());
        mailSender.setUsername(config.username());
        mailSender.setPassword(config.password());
        Properties properties = mailSender.getJavaMailProperties();
        properties.put("mail.smtp.auth", String.valueOf(config.auth()));
        properties.put("mail.smtp.starttls.enable", String.valueOf(config.starttls()));
        return mailSender;
    }
}
