package butvan.agent.network.daily.controller;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.network.annotation.ApiLog;
import butvan.agent.network.common.Result;
import butvan.agent.network.daily.dto.DailyEventRequests.CreateExpenseRequest;
import butvan.agent.network.daily.dto.DailyEventRequests.CreateJournalRequest;
import butvan.agent.network.daily.dto.DailyEventRequests.CreateScheduleRequest;
import butvan.agent.network.daily.dto.DailyEventRequests.CreateTodoRequest;
import butvan.agent.network.daily.dto.DailyEventRequests.TodoCompletionRequest;
import butvan.agent.network.daily.dto.DailyEventResponses;
import butvan.agent.network.daily.dto.DailyEventResponses.DayResponse;
import butvan.agent.network.daily.dto.DailyEventResponses.DaySummaryResponse;
import butvan.agent.network.daily.dto.DailyEventResponses.EventResponse;
import butvan.agent.network.daily.model.DailyEventModels.ExpenseCommand;
import butvan.agent.network.daily.model.DailyEventModels.JournalCommand;
import butvan.agent.network.daily.model.DailyEventModels.ScheduleCommand;
import butvan.agent.network.daily.model.DailyEventModels.TodoCommand;
import butvan.agent.network.daily.service.DailyEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PutMapping;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.DateTimeException;
import java.util.List;

/** 日记录 HTTP 协议适配层。 */
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/agent/daily-events")
@RequiredArgsConstructor
public class DailyEventController {

    private final DailyEventService dailyEventService;
    private final CurrentUserProvider currentUserProvider;

    /** 查询日期范围内的日记录摘要。 */
    @ApiLog("查询日记录日期范围摘要")
    @GetMapping("/days")
    public Result<List<DaySummaryResponse>> days(@RequestParam LocalDate from, @RequestParam LocalDate to) {
        return Result.success(dailyEventService.getDays(currentUserId(), from, to).stream()
                .map(DailyEventResponses::from)
                .toList());
    }

    /** 查询某一天的完整日记录。 */
    @ApiLog("查询单日日记录")
    @GetMapping("/days/{date}")
    public Result<DayResponse> day(@PathVariable LocalDate date) {
        return Result.success(DailyEventResponses.from(dailyEventService.getDay(currentUserId(), date)));
    }

    /** 创建待办日记录。 */
    @ApiLog("创建待办日记录")
    @PostMapping("/todos")
    public Result<EventResponse> createTodo(@RequestBody CreateTodoRequest request) {
        return Result.success(DailyEventResponses.from(dailyEventService.create(currentUserId(),
                new TodoCommand(request.eventDate(), request.title(), request.time(), request.priority(), request.recurrence(),
                        request.recurrenceWeekday(), request.recurrenceMonthDay()))));
    }

    /** 更新待办日记录。 */
    @ApiLog("更新待办日记录")
    @PutMapping("/todos/{eventId}")
    public Result<EventResponse> updateTodo(
            @PathVariable String eventId, @RequestParam int expectedVersion, @RequestBody CreateTodoRequest request) {
        return Result.success(DailyEventResponses.from(dailyEventService.update(currentUserId(), eventId, expectedVersion,
                new TodoCommand(request.eventDate(), request.title(), request.time(), request.priority(), request.recurrence(),
                        request.recurrenceWeekday(), request.recurrenceMonthDay()))));
    }

    /** 创建日程日记录。 */
    @ApiLog("创建日程日记录")
    @PostMapping("/schedules")
    public Result<EventResponse> createSchedule(@RequestBody CreateScheduleRequest request) {
        ZoneId timezone = parseTimezone(request.timezone());
        return Result.success(DailyEventResponses.from(dailyEventService.create(currentUserId(),
                new ScheduleCommand(request.eventDate(), request.title(), request.startTime(), request.endTime(),
                        request.location(), timezone))));
    }

    /** 更新日程日记录。 */
    @ApiLog("更新日程日记录")
    @PutMapping("/schedules/{eventId}")
    public Result<EventResponse> updateSchedule(
            @PathVariable String eventId,
            @RequestParam int expectedVersion,
            @RequestBody CreateScheduleRequest request) {
        ZoneId timezone = parseTimezone(request.timezone());
        return Result.success(DailyEventResponses.from(dailyEventService.update(currentUserId(), eventId, expectedVersion,
                new ScheduleCommand(request.eventDate(), request.title(), request.startTime(), request.endTime(),
                        request.location(), timezone))));
    }

    /** 创建花销日记录。 */
    @ApiLog("创建花销日记录")
    @PostMapping("/expenses")
    public Result<EventResponse> createExpense(@RequestBody CreateExpenseRequest request) {
        String currency = request.currency() == null || request.currency().isBlank() ? "CNY" : request.currency();
        return Result.success(DailyEventResponses.from(dailyEventService.create(currentUserId(),
                new ExpenseCommand(request.eventDate(), request.category(), request.note(), request.amount(),
                        request.time(), currency))));
    }

    /** 更新花销日记录。 */
    @ApiLog("更新花销日记录")
    @PutMapping("/expenses/{eventId}")
    public Result<EventResponse> updateExpense(
            @PathVariable String eventId,
            @RequestParam int expectedVersion,
            @RequestBody CreateExpenseRequest request) {
        String currency = request.currency() == null || request.currency().isBlank() ? "CNY" : request.currency();
        return Result.success(DailyEventResponses.from(dailyEventService.update(currentUserId(), eventId, expectedVersion,
                new ExpenseCommand(request.eventDate(), request.category(), request.note(), request.amount(),
                        request.time(), currency))));
    }

    /** 创建手记日记录。 */
    @ApiLog("创建手记日记录")
    @PostMapping("/journals")
    public Result<EventResponse> createJournal(@RequestBody CreateJournalRequest request) {
        return Result.success(DailyEventResponses.from(dailyEventService.create(currentUserId(),
                new JournalCommand(request.eventDate(), request.title(), request.body(), request.mood()))));
    }

    /** 更新已有手记日记录。 */
    @ApiLog("更新手记日记录")
    @PutMapping("/journals/{eventId}")
    public Result<EventResponse> updateJournal(
            @PathVariable String eventId,
            @RequestParam int expectedVersion,
            @RequestBody CreateJournalRequest request) {
        return Result.success(DailyEventResponses.from(dailyEventService.updateJournal(
                currentUserId(), eventId, expectedVersion,
                new JournalCommand(request.eventDate(), request.title(), request.body(), request.mood()))));
    }

    /** 修改待办完成状态。 */
    @ApiLog("修改待办完成状态")
    @PatchMapping("/{eventId}/todo-completion")
    public Result<EventResponse> setTodoCompleted(
            @PathVariable String eventId, @RequestBody TodoCompletionRequest request) {
        return Result.success(DailyEventResponses.from(dailyEventService.setTodoCompleted(
                currentUserId(), eventId, request.completed(), request.expectedVersion(), request.occurrenceDate())));
    }

    /** 删除一条日记录。 */
    @ApiLog("删除日记录")
    @DeleteMapping("/{eventId}")
    public Result<String> delete(@PathVariable String eventId, @RequestParam int expectedVersion) {
        dailyEventService.delete(currentUserId(), eventId, expectedVersion);
        return Result.success("日记录已删除");
    }

    private String currentUserId() {
        return currentUserProvider.currentUserId();
    }

    private ZoneId parseTimezone(String timezoneValue) {
        try {
            return timezoneValue == null || timezoneValue.isBlank() ? ZoneId.systemDefault() : ZoneId.of(timezoneValue);
        } catch (DateTimeException exception) {
            throw new IllegalArgumentException("日程时区不合法");
        }
    }
}
