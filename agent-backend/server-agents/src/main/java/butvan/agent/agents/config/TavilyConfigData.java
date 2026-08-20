package butvan.agent.agents.config;

/**
 *
 * @param enabled 是否启用联网搜索
 * @param apiKey
 * @param maxResults 每次搜索最后返回几条结果
 * @param searchDepth 搜索深度
 */
public record TavilyConfigData(
        boolean enabled,
        String apiKey,
        int maxResults,
        String searchDepth
) {


    /**
     * 为配置或读取失败时返回的默认值
     * @return
     */
    public static TavilyConfigData disabled() {
        return new TavilyConfigData(false, "", 5, "basic");
    }

    /**
     * 判断是否具备调用搜索的条件
     * <p>这个方法会被 WebSearchTool 在每次调用前检查，防止误用。</p>
     * @return
     */
    public boolean isReady() {
        return enabled && apiKey != null && !apiKey.isBlank() && maxResults >= 1;
    }
}
