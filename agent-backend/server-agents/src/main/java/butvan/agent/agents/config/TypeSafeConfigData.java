package butvan.agent.agents.config;

import butvan.agent.agents.routing.ToolRoutingMode;

/**
 * TypeSafe Jev 本地配置快照。
 *
 * @param enabled 用户是否开启 Jev 路由
 * @param mode 当前灰度模式
 * @param apiKey 用户配置的 TypeSafe API Key
 * @param model 调用的 Jev 模型或别名
 * @param threshold 选中能力组所需的最低 Noul 概率
 */
public record TypeSafeConfigData(
        boolean enabled,
        ToolRoutingMode mode,
        String apiKey,
        String model,
        double threshold
) {

    /**
     * 创建未启用 Jev 时使用的安全默认配置。
     *
     * @return 关闭态配置
     */
    public static TypeSafeConfigData disabled() {
        return new TypeSafeConfigData(false, ToolRoutingMode.OFF, "", "jev-latest", 0.75);
    }

    /**
     * 判断当前配置是否足以发起 Jev 请求。
     *
     * @return 已启用、模式有效且必要字段合法时返回 true
     */
    public boolean isReady() {
        return enabled
                && isConfigured();
    }

    /**
     * 判断 Jev 是否具备开启所需的有效配置，不考虑当前开关状态。
     *
     * @return 模式、凭据、模型和阈值均有效时返回 true
     */
    public boolean isConfigured() {
        return mode != null
                && mode != ToolRoutingMode.OFF
                && apiKey != null
                && !apiKey.isBlank()
                && model != null
                && !model.isBlank()
                && Double.isFinite(threshold)
                && threshold >= 0.0
                && threshold <= 1.0;
    }
}
