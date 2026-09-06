package butvan.agent.network.study.controller;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.network.annotation.ApiLog;
import butvan.agent.network.common.Result;
import butvan.agent.network.study.dto.StudyDtos.ManualStudyRequest;
import butvan.agent.network.study.dto.StudyDtos.StartStudyRequest;
import butvan.agent.network.study.dto.StudyDtos.UpdateStudyRequest;
import butvan.agent.network.study.model.StudyModels.StudySession;
import butvan.agent.network.study.model.StudyModels.StudyStatistics;
import butvan.agent.network.study.service.StudyService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/** 学习记录 HTTP 协议适配层。 */
@RestController
@RequestMapping("/agent/study-sessions")
@RequiredArgsConstructor
public class StudyController {
    private final StudyService studyService;
    private final CurrentUserProvider currentUserProvider;

    /** 开始一段项目内学习。 */
    @ApiLog("开始学习")
    @PostMapping("/start")
    public Result<StudySession> start(@RequestBody StartStudyRequest request) {
        return Result.success(studyService.start(currentUserId(), request.content(), request.category(),
                parseTimezone(request.timezone())));
    }

    /** 结束指定的进行中学习。 */
    @ApiLog("结束学习")
    @PostMapping("/{eventId}/finish")
    public Result<StudySession> finish(@PathVariable String eventId, @RequestParam int expectedVersion) {
        return Result.success(studyService.finish(currentUserId(), eventId, expectedVersion));
    }

    /** 补录一段已结束学习。 */
    @ApiLog("补录学习记录")
    @PostMapping("/manual")
    public Result<StudySession> createManual(@RequestBody ManualStudyRequest request) {
        return Result.success(studyService.createManual(currentUserId(), request.content(), request.category(),
                request.startedAt(), request.endedAt(), parseTimezone(request.timezone()), request.location()));
    }

    /** 修改一段已结束学习。 */
    @ApiLog("修改学习记录")
    @PutMapping("/{eventId}")
    public Result<StudySession> update(
            @PathVariable String eventId, @RequestParam int expectedVersion, @RequestBody UpdateStudyRequest request) {
        return Result.success(studyService.update(currentUserId(), eventId, expectedVersion,
                request.content(), request.category(), request.startedAt(), request.endedAt(),
                parseTimezone(request.timezone()), request.location()));
    }

    /** 删除一段学习记录。 */
    @ApiLog("删除学习记录")
    @DeleteMapping("/{eventId}")
    public Result<String> delete(@PathVariable String eventId, @RequestParam int expectedVersion) {
        studyService.delete(currentUserId(), eventId, expectedVersion);
        return Result.success("学习记录已删除");
    }

    /** 查询当前进行中的学习。 */
    @ApiLog("查询进行中的学习")
    @GetMapping("/active")
    public Result<StudySession> active() {
        return Result.success(studyService.getActive(currentUserId()));
    }

    /** 查询日期范围内的学习记录。 */
    @ApiLog("查询学习记录")
    @GetMapping
    public Result<List<StudySession>> sessions(
            @RequestParam LocalDate from, @RequestParam LocalDate to, @RequestParam String timezone) {
        return Result.success(studyService.getSessions(currentUserId(), from, to, parseTimezone(timezone)));
    }

    /** 查询日期范围内的学习统计。 */
    @ApiLog("查询学习统计")
    @GetMapping("/statistics")
    public Result<StudyStatistics> statistics(
            @RequestParam LocalDate from, @RequestParam LocalDate to, @RequestParam String timezone) {
        return Result.success(studyService.getStatistics(currentUserId(), from, to, parseTimezone(timezone)));
    }

    private String currentUserId() {
        return currentUserProvider.currentUserId();
    }

    private ZoneId parseTimezone(String value) {
        try {
            return value == null || value.isBlank() ? ZoneId.systemDefault() : ZoneId.of(value);
        } catch (DateTimeException exception) {
            throw new IllegalArgumentException("学习时区不合法");
        }
    }
}
