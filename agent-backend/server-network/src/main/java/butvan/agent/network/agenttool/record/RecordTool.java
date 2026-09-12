package butvan.agent.network.agenttool.record;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.agents.tool.AgentToolModule;
import butvan.agent.agents.tool.result.ToolResult;
import butvan.agent.network.agenttool.common.BusinessToolErrors;
import butvan.agent.network.agenttool.common.BusinessToolExecutor;
import butvan.agent.network.record.model.RecordModels.RecordCommand;
import butvan.agent.network.record.model.RecordModels.RecordEntry;
import butvan.agent.network.record.model.RecordModels.RecordType;
import butvan.agent.network.record.service.RecordService;
import io.agentscope.core.tool.Tool;
import io.agentscope.core.tool.ToolParam;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

/** 为 Agent 提供项目内部资料的检索、阅读与维护能力。 */
@Component
@RequiredArgsConstructor
public class RecordTool implements AgentToolModule {
    private static final String SEARCH = "record_search";
    private static final String READ = "record_read";
    private static final String CREATE = "record_create";
    private static final String UPDATE = "record_update";
    private static final String RECYCLE = "record_recycle";
    private static final int MAX_RESULTS = 100;

    private final RecordService recordService;
    private final CurrentUserProvider currentUserProvider;
    private final BusinessToolExecutor businessToolExecutor;

    @Tool(name = SEARCH, description = "按日期、类型、标签、分类或关键词搜索项目内部资料。", readOnly = true)
    public ToolResult<?> search(
            @ToolParam(name = "request", description = "搜索范围与可选筛选条件") SearchRequest request) {
        try {
            if (request == null) throw new IllegalArgumentException("搜索参数不能为空");
            LocalDate from = parseDate(request.from(), "from");
            LocalDate to = parseDate(request.to(), "to");
            int limit = normalizeLimit(request.limit());
            List<RecordEntry> matches = recordService.search(currentUserProvider.currentUserId(), from, to,
                    cleanToNull(request.type()), cleanToNull(request.tag()), cleanToNull(request.keyword()),
                    cleanToNull(request.tabId()));
            boolean truncated = matches.size() > limit;
            List<RecordSummary> items = matches.stream().limit(limit).map(this::toSummary).toList();
            return ToolResult.success("找到 " + items.size() + " 条资料", new SearchResult(items, truncated));
        } catch (RuntimeException exception) {
            return BusinessToolErrors.from(exception);
        }
    }

    @Tool(name = READ, description = "通过稳定资料 ID 读取一条未归档、未回收的项目内部资料。", readOnly = true)
    public ToolResult<?> read(
            @ToolParam(name = "request", description = "要读取的资料 ID") ReadRequest request) {
        try {
            if (request == null) throw new IllegalArgumentException("读取参数不能为空");
            RecordEntry record = recordService.getReference(
                    currentUserProvider.currentUserId(), required(request.recordId(), "recordId"));
            return ToolResult.success("已读取资料：“" + displayTitle(record) + "”", record);
        } catch (RuntimeException exception) {
            return BusinessToolErrors.from(exception);
        }
    }

    @Tool(name = CREATE, description = "新建一条项目内部资料。正文使用纯文本，不接受网页或文件导入。")
    public ToolResult<?> create(
            @ToolParam(name = "request", description = "资料内容；写入前会请求用户确认") CreateRequest request) {
        try {
            if (request == null) throw new IllegalArgumentException("新建参数不能为空");
            String ownerId = currentUserProvider.currentUserId();
            return businessToolExecutor.write(ownerId, CREATE, request.idempotencyKey(), () -> {
                RecordEntry created = recordService.create(ownerId, new RecordCommand(
                        parseDate(request.recordDate(), "recordDate"), parseType(request.type()), request.title(),
                        toHtml(request.content()), clean(request.content()), request.tags(), cleanToNull(request.tabId())));
                return ToolResult.success("已新建资料：“" + displayTitle(created) + "”", created);
            });
        } catch (RuntimeException exception) {
            return BusinessToolErrors.from(exception);
        }
    }

    @Tool(name = UPDATE, description = "部分更新一条资料的内容或展示状态；未传字段保持不变。")
    public ToolResult<?> update(
            @ToolParam(name = "request", description = "资料 ID、版本和需要修改的字段；写入前会请求用户确认") UpdateRequest request) {
        try {
            if (request == null) throw new IllegalArgumentException("更新参数不能为空");
            String ownerId = currentUserProvider.currentUserId();
            return businessToolExecutor.write(ownerId, UPDATE, request.idempotencyKey(), () -> {
                String id = required(request.recordId(), "recordId");
                RecordEntry current = recordService.get(ownerId, id);
                boolean contentChanged = hasContentPatch(request);
                boolean flagsChanged = request.pinned() != null || request.favorite() != null || request.archived() != null;
                if (!contentChanged && !flagsChanged) throw new IllegalArgumentException("至少需要传入一个要修改的字段");

                RecordEntry updated = current;
                if (contentChanged) {
                    String content = request.content() == null ? current.contentText() : clean(request.content());
                    updated = recordService.update(ownerId, id, request.expectedVersion(), new RecordCommand(
                            optionalDate(request.recordDate(), current.recordDate()),
                            request.type() == null ? current.type() : parseType(request.type()),
                            request.title() == null ? current.title() : request.title(),
                            request.content() == null ? current.contentHtml() : toHtml(content), content,
                            request.tags() == null ? current.tags() : request.tags(),
                            request.tabId() == null ? current.tabId() : cleanToNull(request.tabId())));
                }
                if (flagsChanged) {
                    int version = contentChanged ? updated.version() : request.expectedVersion();
                    updated = recordService.updateFlags(ownerId, id, version,
                            request.pinned(), request.favorite(), request.archived());
                }
                return ToolResult.success("已更新资料：“" + displayTitle(updated) + "”", updated);
            });
        } catch (RuntimeException exception) {
            return BusinessToolErrors.from(exception);
        }
    }

    @Tool(name = RECYCLE, description = "将资料移入回收站，或从回收站恢复资料。")
    public ToolResult<?> recycle(
            @ToolParam(name = "request", description = "action 为 trash 或 restore；写入前会请求用户确认") RecycleRequest request) {
        try {
            if (request == null) throw new IllegalArgumentException("回收站参数不能为空");
            String ownerId = currentUserProvider.currentUserId();
            return businessToolExecutor.write(ownerId, RECYCLE, request.idempotencyKey(), () -> {
                String id = required(request.recordId(), "recordId");
                return switch (required(request.action(), "action")) {
                    case "trash" -> {
                        RecordEntry current = recordService.get(ownerId, id);
                        recordService.trash(ownerId, id, request.expectedVersion());
                        RecordEntry trashed = recordService.get(ownerId, id);
                        yield ToolResult.success("已将资料移入回收站：“" + displayTitle(current) + "”", trashed);
                    }
                    case "restore" -> {
                        RecordEntry restored = recordService.restore(ownerId, id, request.expectedVersion());
                        yield ToolResult.success("已恢复资料：“" + displayTitle(restored) + "”", restored);
                    }
                    default -> throw new IllegalArgumentException("action 只能是 trash 或 restore");
                };
            });
        } catch (RuntimeException exception) {
            return BusinessToolErrors.from(exception);
        }
    }

    private boolean hasContentPatch(UpdateRequest request) {
        return request.recordDate() != null || request.type() != null || request.title() != null
                || request.content() != null || request.tags() != null || request.tabId() != null;
    }

    private RecordSummary toSummary(RecordEntry record) {
        String text = clean(record.contentText());
        String summary = text.length() <= 160 ? text : text.substring(0, 160) + "…";
        return new RecordSummary(record.id(), record.recordDate(), record.type().value(), record.title(), summary,
                record.tags(), record.tabId(), record.pinned(), record.favorite(), record.version(), record.updatedAt());
    }

    private String toHtml(String content) {
        String escaped = HtmlUtils.htmlEscape(clean(content)).replace("\r\n", "\n").replace('\r', '\n');
        return escaped.isEmpty() ? "" : "<p>" + escaped.replace("\n", "<br>") + "</p>";
    }

    private RecordType parseType(String value) {
        return RecordType.parse(required(value, "type").toLowerCase(Locale.ROOT));
    }

    private LocalDate parseDate(String value, String field) {
        try {
            return LocalDate.parse(required(value, field));
        } catch (DateTimeException exception) {
            throw new IllegalArgumentException(field + " 必须使用 YYYY-MM-DD 格式");
        }
    }

    private LocalDate optionalDate(String value, LocalDate fallback) {
        return value == null ? fallback : parseDate(value, "recordDate");
    }

    private int normalizeLimit(Integer value) {
        int limit = value == null ? 30 : value;
        if (limit < 1 || limit > MAX_RESULTS) throw new IllegalArgumentException("limit 必须在 1 至 100 之间");
        return limit;
    }

    private String displayTitle(RecordEntry record) {
        return record.title() == null || record.title().isBlank() ? "无标题资料" : record.title();
    }

    private String required(String value, String field) {
        String cleaned = clean(value);
        if (cleaned.isEmpty()) throw new IllegalArgumentException(field + " 不能为空");
        return cleaned;
    }

    private String cleanToNull(String value) {
        String cleaned = clean(value);
        return cleaned.isEmpty() ? null : cleaned;
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }

    public record SearchRequest(
            String from, String to, String type, String tag, String keyword, String tabId, Integer limit) {
    }

    public record SearchResult(List<RecordSummary> items, boolean truncated) {
    }

    public record RecordSummary(
            String id, LocalDate recordDate, String type, String title, String summary, List<String> tags,
            String tabId, boolean pinned, boolean favorite, int version, java.time.Instant updatedAt) {
    }

    public record ReadRequest(String recordId) {
    }

    public record CreateRequest(
            String recordDate, String type, String title, String content, List<String> tags,
            String tabId, String idempotencyKey) {
    }

    public record UpdateRequest(
            String recordId, int expectedVersion, String recordDate, String type, String title,
            String content, List<String> tags, String tabId, Boolean pinned, Boolean favorite,
            Boolean archived, String idempotencyKey) {
    }

    public record RecycleRequest(String recordId, int expectedVersion, String action, String idempotencyKey) {
    }
}
