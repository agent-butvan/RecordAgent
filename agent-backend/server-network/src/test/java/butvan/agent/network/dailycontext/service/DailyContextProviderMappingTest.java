package butvan.agent.network.dailycontext.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 第三方响应映射测试，确保供应商字段不会泄漏到前端接口。 */
class DailyContextProviderMappingTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void qWeatherResponseMapsToStableWeatherSummary() throws Exception {
        var payload = mapper.readTree("""
                {
                  "condition": {"text": "多云", "code": "101"},
                  "temperature": {"value": 26.4, "unit": "°C"},
                  "feelsLike": {"value": 27.1, "unit": "°C"},
                  "humidity": 0.68,
                  "wind": {"direction": {"compass": "se"}, "speed": {"value": 3.2, "unit": "m/s"}}
                }
                """);

        var result = QWeatherClient.parse(payload, "上海");

        assertEquals("多云", result.condition());
        assertEquals(26.4, result.temperature());
        assertEquals(68, result.humidityPercent());
        assertEquals("上海", result.locationName());
    }

    @Test
    void tianApiResponseMapsHolidayAndWorkdaySemantics() throws Exception {
        var payload = mapper.readTree("""
                {
                  "code": 200,
                  "msg": "success",
                  "result": {
                    "list": [{
                      "name": "国庆节", "info": "节假日", "daycode": 1,
                      "isnotwork": 1, "wage": 3, "lunarmonth": "八月", "lunarday": "十一", "tip": "放假安排"
                    }]
                  }
                }
                """);

        var result = TianApiHolidayClient.parse(payload);

        assertEquals("国庆节", result.name());
        assertTrue(result.dayOff());
        assertEquals(3, result.wageMultiple());
        assertEquals("八月十一", result.lunarDate());
    }
}
