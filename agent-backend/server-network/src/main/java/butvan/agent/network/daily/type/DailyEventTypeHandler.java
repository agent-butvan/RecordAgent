package butvan.agent.network.daily.type;

import butvan.agent.network.daily.model.DailyEventModels.DailyEventCommand;

import java.util.List;
import java.util.Map;

/** 每种日记录详情的持久化 seam；新增类型通过新实现接入。 */
public interface DailyEventTypeHandler<C extends DailyEventCommand> {

    /** 稳定的日记录类型标识。 */
    String eventType();

    /** 处理器接受的命令类型。 */
    Class<C> commandType();

    /** 校验类型专属字段。 */
    void validate(C command);

    /** 保存类型详情。 */
    void insert(String eventId, C command);

    /** 覆盖保存现有类型详情，不改变日记录 ID。 */
    void update(String eventId, C command);

    /** 批量加载类型详情，键为日记录 ID。 */
    Map<String, Object> loadDetails(List<String> eventIds);
}
