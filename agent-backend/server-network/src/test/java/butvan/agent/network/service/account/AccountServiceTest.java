package butvan.agent.network.service.account;

import butvan.agent.agents.config.LocalConfigService;
import butvan.agent.network.dto.account.AccountStatusResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 账户绑定服务单元测试：覆盖验证码冷却/次数上限与密码哈希持久化。 */
class AccountServiceTest {

    private FakeConfigService configService;
    private FakeSender sender;
    private AccountService accountService;

    @BeforeEach
    void setUp() {
        configService = new FakeConfigService();
        sender = new FakeSender();
        accountService = new AccountService(configService, sender, new ObjectMapper());
    }

    @Test
    void sendVerificationCode_enforcesPerEmailCooldown() {
        accountService.sendVerificationCode("Test@Example.com");

        assertThrows(IllegalArgumentException.class,
                () -> accountService.sendVerificationCode("test@example.com"));
        assertEquals(1, sender.sentCodes.size());
    }

    @Test
    void bindEmail_rejectsAfterMaxVerifyAttemptsEvenWithCorrectCode() {
        accountService.sendVerificationCode("user@example.com");
        String code = sender.lastCode();
        assertNotNull(code);

        for (int i = 0; i < 5; i++) {
            assertThrows(IllegalArgumentException.class,
                    () -> accountService.bindEmail("user@example.com", "password123", "000000"));
        }
        assertThrows(IllegalArgumentException.class,
                () -> accountService.bindEmail("user@example.com", "password123", code));
    }

    @Test
    void bindEmail_persistsHashedPasswordAndBoundStatus() {
        accountService.sendVerificationCode("user@example.com");
        String code = sender.lastCode();
        assertNotNull(code);

        AccountStatusResponse response =
                accountService.bindEmail("user@example.com", "password123", code);

        assertTrue(response.isBound());
        assertTrue(response.isEmailNotificationsEnabled());
        assertTrue(response.getMaskedEmail().startsWith("us"));

        Object rawAccount = configService.data.getExtraFields().get("account");
        assertNotNull(rawAccount);

        AccountConfigData saved = new ObjectMapper().convertValue(rawAccount, AccountConfigData.class);
        assertEquals("user@example.com", saved.getEmail());
        assertTrue(saved.isEmailVerified());
        assertNotEquals("password123", saved.getPasswordHash());
        assertTrue(saved.getPasswordHash().startsWith("pbkdf2$"));
    }

    @Test
    void getStatus_returnsUnboundWhenNoAccountStored() {
        AccountStatusResponse status = accountService.getStatus();

        assertFalse(status.isBound());
        assertNull(status.getMaskedEmail());
        assertFalse(status.isEmailNotificationsEnabled());
    }

    /** 仅覆写读写方法的内存版配置服务，避免触碰 ~/.butvan-agent/config.json。 */
    private static final class FakeConfigService extends LocalConfigService {
        private LocalConfigService.ModelConfigData data = new LocalConfigService.ModelConfigData();

        @Override
        public LocalConfigService.ModelConfigData loadFullConfigData() {
            return data;
        }

        @Override
        public synchronized void saveFullConfigData(LocalConfigService.ModelConfigData fullData) {
            this.data = fullData;
        }
    }

    /** 内存版验证码发送器，记录最近一次发送的验证码。 */
    private static final class FakeSender implements EmailVerificationSender {
        private final List<String> sentCodes = new ArrayList<>();

        @Override
        public void send(String email, String verificationCode) {
            sentCodes.add(verificationCode);
        }

        private String lastCode() {
            return sentCodes.isEmpty() ? null : sentCodes.get(sentCodes.size() - 1);
        }
    }
}
