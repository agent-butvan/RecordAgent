package butvan.agent.network.daily.type;

import butvan.agent.network.daily.model.DailyEventModels.DailyEventCommand;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/** 根据稳定类型标识路由到对应详情处理器。 */
@Component
@RequiredArgsConstructor
public class DailyEventTypeRegistry {

    private final List<DailyEventTypeHandler<?>> handlers;

    /** 校验并保存一条类型详情。 */
    public void insert(String eventId, DailyEventCommand command) {
        DailyEventTypeHandler<?> handler = handlersByType().get(command.eventType());
        if (handler == null || !handler.commandType().isInstance(command)) {
            throw new IllegalArgumentException("不支持的日记录类型: " + command.eventType());
        }
        insertTyped(handler, eventId, command);
    }

    /** 校验并更新一条类型详情。 */
    public void update(String eventId, DailyEventCommand command) {
        DailyEventTypeHandler<?> handler = handlersByType().get(command.eventType());
        if (handler == null || !handler.commandType().isInstance(command)) {
            throw new IllegalArgumentException("不支持的日记录类型: " + command.eventType());
        }
        updateTyped(handler, eventId, command);
    }

    /** 按类型批量加载详情，避免核心模块了解每种字段。 */
    public Map<String, Object> loadDetails(Map<String, List<String>> eventIdsByType) {
        Map<String, DailyEventTypeHandler<?>> byType = handlersByType();
        Map<String, Object> result = new LinkedHashMap<>();
        eventIdsByType.forEach((type, eventIds) -> {
            DailyEventTypeHandler<?> handler = byType.get(type);
            if (handler != null) {
                result.putAll(handler.loadDetails(eventIds));
            }
        });
        return result;
    }

    @SuppressWarnings("unchecked")
    private <C extends DailyEventCommand> void insertTyped(
            DailyEventTypeHandler<?> rawHandler, String eventId, DailyEventCommand rawCommand) {
        DailyEventTypeHandler<C> handler = (DailyEventTypeHandler<C>) rawHandler;
        C command = handler.commandType().cast(rawCommand);
        handler.validate(command);
        handler.insert(eventId, command);
    }

    @SuppressWarnings("unchecked")
    private <C extends DailyEventCommand> void updateTyped(
            DailyEventTypeHandler<?> rawHandler, String eventId, DailyEventCommand rawCommand) {
        DailyEventTypeHandler<C> handler = (DailyEventTypeHandler<C>) rawHandler;
        C command = handler.commandType().cast(rawCommand);
        handler.validate(command);
        handler.update(eventId, command);
    }

    private Map<String, DailyEventTypeHandler<?>> handlersByType() {
        return handlers.stream().collect(Collectors.toUnmodifiableMap(
                DailyEventTypeHandler::eventType,
                Function.identity()));
    }
}
