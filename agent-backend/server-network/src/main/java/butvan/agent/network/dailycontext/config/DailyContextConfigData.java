package butvan.agent.network.dailycontext.config;

import lombok.Data;

/** config.json 的 dailyContext 节点，保存天气、节假日供应商及用户地点配置。 */
@Data
public class DailyContextConfigData {
    private QWeatherConfig qweather = new QWeatherConfig();
    private TianApiConfig tianApi = new TianApiConfig();

    /** 和风天气 API KEY 认证配置。 */
    @Data
    public static class QWeatherConfig {
        private String apiHost = "";
        private String apiKey = "";
        private String locationName = "";
        private Double latitude;
        private Double longitude;
    }

    /** 天聚数行节假日接口配置。 */
    @Data
    public static class TianApiConfig {
        private String apiKey = "";
    }
}
