package butvan.agent.feishu.config;

/**
 * 飞书渠道本地配置数据，对应 {@code ~/.butvan-agent/config.json} 中的 feishu 节点。
 *
 * @param enabled   是否启用飞书机器人
 * @param appId     飞书开放平台应用 App ID
 * @param appSecret 飞书开放平台应用 App Secret
 */
public record FeishuConfigData(boolean enabled, String appId, String appSecret) {

    /** 未配置或读取失败时返回的默认值。 */
    public static FeishuConfigData disabled() {
        return new FeishuConfigData(false, "", "");
    }

    /** 是否具备建立长连接的条件（已启用且凭证完整）。 */
    public boolean isReady() {
        return enabled
                && appId != null && !appId.isBlank()
                && appSecret != null && !appSecret.isBlank();
    }
}
