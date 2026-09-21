package butvan.agent.network.jev.dto;

/** Jev 开关接口使用的稳定 DTO，禁止向前端暴露凭据。 */
public final class JevDtos {

    private JevDtos() {
    }

    /**
     * @param enabled 用户是否已开启 Jev
     * @param available 当前配置是否允许开启
     */
    public record StatusResponse(boolean enabled, boolean available) {
    }

    /**
     * @param enabled 目标开关状态
     */
    public record UpdateEnabledRequest(boolean enabled) {
    }
}
