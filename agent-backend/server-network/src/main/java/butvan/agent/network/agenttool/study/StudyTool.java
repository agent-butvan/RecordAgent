package butvan.agent.network.agenttool.study;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.agents.tool.AgentToolModule;
import butvan.agent.agents.tool.result.ToolResult;
import butvan.agent.network.agenttool.common.BusinessToolErrors;
import butvan.agent.network.agenttool.common.BusinessToolExecutor;
import butvan.agent.network.study.model.StudyModels.StudySession;
import butvan.agent.network.study.service.StudyService;
import io.agentscope.core.tool.Tool;
import io.agentscope.core.tool.ToolParam;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

/** 为 Agent 提供学习打卡、补录、维护与统计能力。 */
@Component
@RequiredArgsConstructor
public class StudyTool implements AgentToolModule {
    private static final String QUERY = "study_query";
    private static final String START = "study_start";
    private static final String FINISH = "study_finish";
    private static final String CREATE_MANUAL = "study_create_manual";
    private static final String UPDATE = "study_update";
    private static final String DELETE = "study_delete";
    private static final int MAX_RESULTS = 100;

    private final StudyService studyService;
    private final CurrentUserProvider currentUserProvider;
    private final BusinessToolExecutor businessToolExecutor;

    @Tool(name = QUERY, description = "查询进行中学习、学习时段、统计或分类选项。", readOnly = true)
    public ToolResult<?> query(
            @ToolParam(name = "request", description = "view 为 active、sessions、statistics 或 categories") QueryRequest request) {
        try {
            if (request == null) throw new IllegalArgumentException("查询参数不能为空");
            String ownerId = currentUserProvider.currentUserId();
            return switch (required(request.view(), "view")) {
                case "active" -> {
                    StudySession active = studyService.getActive(ownerId);
                    yield ToolResult.success(active == null ? "当前没有进行中的学习" : "已读取进行中的学习", active);
                }
                case "categories" -> {
                    List<String> categories = studyService.getCategories(ownerId);
                    yield ToolResult.success("已读取 " + categories.size() + " 个学习分类", categories);
                }
                case "sessions" -> querySessions(ownerId, request);
                case "statistics" -> ToolResult.success("已读取学习统计",
                        studyService.getStatistics(ownerId, parseDate(request.from(), "from"),
                                parseDate(request.to(), "to"), parseTimezone(request.timezone())));
                default -> throw new IllegalArgumentException(
                        "view 只能是 active、sessions、statistics 或 categories");
            };
        } catch (RuntimeException exception) {
            return BusinessToolErrors.from(exception);
        }
    }

    @Tool(name = START, description = "立即开始一段学习；同一用户同时只能有一段进行中的学习。")
    public ToolResult<?> start(
            @ToolParam(name = "request", description = "学习内容、分类和时区；写入前会请求用户确认") StartRequest request) {
        try {
            if (request == null) throw new IllegalArgumentException("开始学习参数不能为空");
            String ownerId = currentUserProvider.currentUserId();
            return businessToolExecutor.write(ownerId, START, request.idempotencyKey(), () -> {
                StudySession started = studyService.start(ownerId, request.content(), request.category(),
                        parseTimezone(request.timezone()));
                return ToolResult.success("已开始学习：“" + started.content() + "”", started);
            });
        } catch (RuntimeException exception) {
            return BusinessToolErrors.from(exception);
        }
    }

    @Tool(name = FINISH, description = "以当前服务时间结束指定的进行中学习。")
    public ToolResult<?> finish(
            @ToolParam(name = "request", description = "学习 ID 与版本；写入前会请求用户确认") VersionedRequest request) {
        try {
            if (request == null) throw new IllegalArgumentException("结束学习参数不能为空");
            String ownerId = currentUserProvider.currentUserId();
            return businessToolExecutor.write(ownerId, FINISH, request.idempotencyKey(), () -> {
                StudySession finished = studyService.finish(
                        ownerId, required(request.sessionId(), "sessionId"), request.expectedVersion());
                return ToolResult.success("已结束学习：“" + finished.content() + "”", finished);
            });
        } catch (RuntimeException exception) {
            return BusinessToolErrors.from(exception);
        }
    }

    @Tool(name = CREATE_MANUAL, description = "补录一段已结束且不与已有记录重叠的学习时段。")
    public ToolResult<?> createManual(
            @ToolParam(name = "request", description = "学习内容与 ISO-8601 起止时间；写入前会请求用户确认") ManualRequest request) {
        try {
            if (request == null) throw new IllegalArgumentException("补录学习参数不能为空");
            String ownerId = currentUserProvider.currentUserId();
            return businessToolExecutor.write(ownerId, CREATE_MANUAL, request.idempotencyKey(), () -> {
                StudySession created = studyService.createManual(ownerId, request.content(), request.category(),
                        parseInstant(request.startedAt(), "startedAt"), parseInstant(request.endedAt(), "endedAt"),
                        parseTimezone(request.timezone()), request.location());
                return ToolResult.success("已补录学习：“" + created.content() + "”", created);
            });
        } catch (RuntimeException exception) {
            return BusinessToolErrors.from(exception);
        }
    }

    @Tool(name = UPDATE, description = "部分更新一段已结束的学习时段；未传字段保持不变。")
    public ToolResult<?> update(
            @ToolParam(name = "request", description = "学习 ID、版本和需要修改的字段；写入前会请求用户确认") UpdateRequest request) {
        try {
            if (request == null) throw new IllegalArgumentException("更新学习参数不能为空");
            String ownerId = currentUserProvider.currentUserId();
            return businessToolExecutor.write(ownerId, UPDATE, request.idempotencyKey(), () -> {
                String id = required(request.sessionId(), "sessionId");
                StudySession current = studyService.getSession(ownerId, id);
                if (!hasPatch(request)) throw new IllegalArgumentException("至少需要传入一个要修改的字段");
                StudySession updated = studyService.update(ownerId, id, request.expectedVersion(),
                        preserve(request.content(), current.content()), preserve(request.category(), current.category()),
                        optionalInstant(request.startedAt(), current.startedAt(), "startedAt"),
                        optionalInstant(request.endedAt(), current.endedAt(), "endedAt"),
                        request.timezone() == null ? ZoneId.of(current.timezone()) : parseTimezone(request.timezone()),
                        request.location() == null ? current.location() : request.location());
                return ToolResult.success("已更新学习：“" + updated.content() + "”", updated);
            });
        } catch (RuntimeException exception) {
            return BusinessToolErrors.from(exception);
        }
    }

    @Tool(name = DELETE, description = "删除一段学习记录。")
    public ToolResult<?> delete(
            @ToolParam(name = "request", description = "学习 ID 与版本；写入前会请求用户确认") VersionedRequest request) {
        try {
            if (request == null) throw new IllegalArgumentException("删除学习参数不能为空");
            String ownerId = currentUserProvider.currentUserId();
            return businessToolExecutor.write(ownerId, DELETE, request.idempotencyKey(), () -> {
                String id = required(request.sessionId(), "sessionId");
                StudySession current = studyService.getSession(ownerId, id);
                studyService.delete(ownerId, id, request.expectedVersion());
                return ToolResult.success("已删除学习：“" + current.content() + "”", Map.of("sessionId", id));
            });
        } catch (RuntimeException exception) {
            return BusinessToolErrors.from(exception);
        }
    }

    private ToolResult<?> querySessions(String ownerId, QueryRequest request) {
        List<StudySession> sessions = studyService.getSessions(ownerId, parseDate(request.from(), "from"),
                parseDate(request.to(), "to"), parseTimezone(request.timezone()));
        int limit = request.limit() == null ? 50 : request.limit();
        if (limit < 1 || limit > MAX_RESULTS) throw new IllegalArgumentException("limit 必须在 1 至 100 之间");
        boolean truncated = sessions.size() > limit;
        return ToolResult.success("找到 " + Math.min(sessions.size(), limit) + " 段学习",
                new SessionQueryResult(sessions.stream().limit(limit).toList(), truncated));
    }

    private boolean hasPatch(UpdateRequest request) {
        return request.content() != null || request.category() != null || request.startedAt() != null
                || request.endedAt() != null || request.timezone() != null || request.location() != null;
    }

    private Instant optionalInstant(String value, Instant fallback, String field) {
        return value == null ? fallback : parseInstant(value, field);
    }

    private Instant parseInstant(String value, String field) {
        try {
            return Instant.parse(required(value, field));
        } catch (DateTimeException exception) {
            throw new IllegalArgumentException(field + " 必须是带时区的 ISO-8601 时间");
        }
    }

    private LocalDate parseDate(String value, String field) {
        try {
            return LocalDate.parse(required(value, field));
        } catch (DateTimeException exception) {
            throw new IllegalArgumentException(field + " 必须使用 YYYY-MM-DD 格式");
        }
    }

    private ZoneId parseTimezone(String value) {
        try {
            return value == null || value.isBlank() ? ZoneId.systemDefault() : ZoneId.of(value.trim());
        } catch (DateTimeException exception) {
            throw new IllegalArgumentException("学习时区不合法");
        }
    }

    private String preserve(String value, String fallback) {
        return value == null ? fallback : value;
    }

    private String required(String value, String field) {
        String cleaned = value == null ? "" : value.trim();
        if (cleaned.isEmpty()) throw new IllegalArgumentException(field + " 不能为空");
        return cleaned;
    }

    public record QueryRequest(String view, String from, String to, String timezone, Integer limit) {
    }

    public record SessionQueryResult(List<StudySession> items, boolean truncated) {
    }

    public record StartRequest(String content, String category, String timezone, String idempotencyKey) {
    }

    public record VersionedRequest(String sessionId, int expectedVersion, String idempotencyKey) {
    }

    public record ManualRequest(
            String content, String category, String startedAt, String endedAt,
            String timezone, String location, String idempotencyKey) {
    }

    public record UpdateRequest(
            String sessionId, int expectedVersion, String content, String category,
            String startedAt, String endedAt, String timezone, String location, String idempotencyKey) {
    }
}
