package butvan.agent.network.daily.type;

import butvan.agent.network.daily.model.DailyEventModels.ExpenseCommand;
import butvan.agent.network.daily.model.DailyEventModels.ExpenseDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 花销详情处理器，金额以最小货币单位整数存储。 */
@Component
@RequiredArgsConstructor
public class ExpenseTypeHandler implements DailyEventTypeHandler<ExpenseCommand> {
    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedJdbcTemplate;

    @Override public String eventType() { return "expense"; }
    @Override public Class<ExpenseCommand> commandType() { return ExpenseCommand.class; }

    @Override
    public void validate(ExpenseCommand command) {
        if (command.category() == null || command.category().isBlank()) throw new IllegalArgumentException("花销分类不能为空");
        if (command.note() == null || command.note().isBlank()) throw new IllegalArgumentException("花销说明不能为空");
        if (command.amount() == null || command.amount().signum() <= 0 || command.amount().scale() > 2) {
            throw new IllegalArgumentException("花销金额必须大于零且最多保留两位小数");
        }
        if (command.currency() == null || !command.currency().matches("[A-Z]{3}")) throw new IllegalArgumentException("货币代码不合法");
        try {
            java.time.LocalTime.parse(command.time());
        } catch (java.time.format.DateTimeParseException | NullPointerException exception) {
            throw new IllegalArgumentException("花销时间不合法");
        }
    }

    @Override
    public void insert(String eventId, ExpenseCommand command) {
        long minor = command.amount().movePointRight(2).setScale(0, RoundingMode.UNNECESSARY).longValueExact();
        jdbcTemplate.update("INSERT INTO expense_detail (event_id, category, note, amount_minor, expense_time, currency) VALUES (?, ?, ?, ?, ?, ?)",
                eventId, command.category().trim(), command.note().trim(), minor, command.time(), command.currency());
    }

    @Override
    public void update(String eventId, ExpenseCommand command) {
        long minor = command.amount().movePointRight(2).setScale(0, RoundingMode.UNNECESSARY).longValueExact();
        int updated = jdbcTemplate.update("""
                UPDATE expense_detail
                SET category = ?, note = ?, amount_minor = ?, expense_time = ?, currency = ?
                WHERE event_id = ?
                """, command.category().trim(), command.note().trim(), minor,
                command.time(), command.currency(), eventId);
        if (updated != 1) throw new IllegalArgumentException("花销记录不存在");
    }

    @Override
    public Map<String, Object> loadDetails(List<String> eventIds) {
        if (eventIds.isEmpty()) return Map.of();
        return namedJdbcTemplate.query("SELECT event_id, category, note, amount_minor, expense_time, currency FROM expense_detail WHERE event_id IN (:ids)",
                Map.of("ids", eventIds), resultSet -> {
                    Map<String, Object> result = new LinkedHashMap<>();
                    while (resultSet.next()) result.put(resultSet.getString("event_id"), new ExpenseDetails(
                            resultSet.getString("category"), resultSet.getString("note"),
                            BigDecimal.valueOf(resultSet.getLong("amount_minor"), 2), resultSet.getString("expense_time"),
                            resultSet.getString("currency")));
                    return result;
                });
    }
}
