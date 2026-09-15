package butvan.agent.network.dailycontext.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** 天气与节假日模块的稳定 HTTP DTO，隔离第三方响应结构。 */
public final class DailyContextDtos {
    private DailyContextDtos() {
    }

    public record ConfigResponse(
            String qweatherApiHost,
            boolean qweatherApiKeyConfigured,
            String locationName,
            Double latitude,
            Double longitude,
            boolean tianApiKeyConfigured
    ) {
    }

    public record UpdateConfigRequest(
            String qweatherApiHost,
            String qweatherApiKey,
            boolean clearQweatherApiKey,
            String locationName,
            Double latitude,
            Double longitude,
            String tianApiKey,
            boolean clearTianApiKey
    ) {
    }

    public record SummaryResponse(
            LocalDate date,
            WeatherResponse weather,
            HolidayResponse holiday,
            String weatherError,
            String holidayError
    ) {
    }

    public record LocationResponse(
            String locationName,
            String adminArea,
            String country
    ) {
    }

    public record WeatherResponse(
            String locationName,
            String condition,
            String conditionCode,
            double temperature,
            String temperatureUnit,
            double feelsLike,
            int humidityPercent,
            String windDirection,
            double windSpeed,
            String windSpeedUnit,
            String attributionUrl
    ) {
    }

    public record HolidayResponse(
            String name,
            String description,
            int dayCode,
            boolean dayOff,
            int wageMultiple,
            String lunarDate,
            String tip
    ) {
    }

    public record QWeatherConsoleResponse(
            QWeatherFinanceResponse finance,
            QWeatherUsageResponse usage,
            String financeError,
            String usageError
    ) {
    }

    public record QWeatherFinanceResponse(
            Instant asOf,
            String currency,
            BigDecimal balance,
            BigDecimal previousDayCharges,
            BigDecimal thisMonthCharges,
            BigDecimal sinceLastBillCharges,
            int pendingBillCount,
            BigDecimal pendingAmountDue
    ) {
    }

    public record QWeatherUsageResponse(
            Instant asOf,
            long successRequests,
            long errorRequests,
            List<QWeatherApiUsageResponse> apis
    ) {
    }

    public record QWeatherApiUsageResponse(
            String api,
            long successRequests,
            long errorRequests
    ) {
    }
}
