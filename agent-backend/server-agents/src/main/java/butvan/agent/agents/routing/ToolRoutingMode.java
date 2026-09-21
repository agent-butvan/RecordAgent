package butvan.agent.agents.routing;

import java.util.Locale;

/**
 * Jev 工具路由的运行模式。
 */
public enum ToolRoutingMode {

    /**
     * 完全关闭，不请求 Jev，也不改变 Tool Schema。
     */
    OFF,
    /**
     * 影子运行：请求 Jev 并记录结果，但不改变 Tool Schema。
     */
    SHADOW,
    /**
     * 正式运行：请求 Jev，并把结果应用到当前模型调用。
     */
    ACTIVE;


    /**
     * 把用户配置文本安全转换为路由模式。
     *
     * @param value 配置文件中的模式文本，例如 off、shadow、active
     * @return 对应模式；空值或未知值返回 OFF
     */
    public static ToolRoutingMode parse(String value) {
        if (value == null || value.isBlank()) return OFF;

        try {
            return valueOf(value.strip().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return OFF;
        }
    }
}
