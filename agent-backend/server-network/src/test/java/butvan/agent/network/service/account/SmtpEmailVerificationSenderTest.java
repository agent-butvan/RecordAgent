package butvan.agent.network.service.account;

import butvan.agent.agents.config.LocalConfigService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertThrows;

/** SMTP 发送器单元测试：未配置 mail 节点时应返回可识别的服务不可用异常。 */
class SmtpEmailVerificationSenderTest {

    @Test
    void send_throwsWhenMailNodeMissing() {
        SmtpEmailVerificationSender sender =
                new SmtpEmailVerificationSender(new FakeConfigService(), new ObjectMapper());

        assertThrows(IllegalStateException.class,
                () -> sender.send("user@example.com", "123456"));
    }

    /** 空配置的内存版配置服务，不触碰 ~/.butvan-agent/config.json。 */
    private static final class FakeConfigService extends LocalConfigService {
        private final LocalConfigService.ModelConfigData data = new LocalConfigService.ModelConfigData();

        @Override
        public LocalConfigService.ModelConfigData loadFullConfigData() {
            return data;
        }
    }
}
