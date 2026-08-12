package butvan.agent.agents.identity;

import org.springframework.stereotype.Component;

/**
 * 获取当前调用者的稳定身份。
 *
 * <p>当前是单机桌面版，因此返回固定本地用户。未来接入登录系统时，
 * 只替换这里为“从 Spring Security / Tauri 身份令牌读取用户 ID”即可。</p>
 */
@Component
public class CurrentUserProvider {

    /**
     * 返回当前用户 ID。
     *
     * @return 不能为 null 或空白的稳定用户 ID
     */
    public String currentUserId() {
        return "local-default";
    }
}
