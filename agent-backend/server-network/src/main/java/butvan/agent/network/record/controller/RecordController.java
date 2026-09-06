package butvan.agent.network.record.controller;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.network.annotation.ApiLog;
import butvan.agent.network.common.Result;
import butvan.agent.network.record.dto.RecordDtos;
import butvan.agent.network.record.dto.RecordDtos.DaySummaryResponse;
import butvan.agent.network.record.dto.RecordDtos.RecordResponse;
import butvan.agent.network.record.dto.RecordDtos.SaveRecordRequest;
import butvan.agent.network.record.dto.RecordDtos.UpdateFlagsRequest;
import butvan.agent.network.record.model.RecordModels.RecordCommand;
import butvan.agent.network.record.model.RecordModels.RecordType;
import butvan.agent.network.record.service.RecordService;
import butvan.agent.network.record.service.RecordAttachmentService;
import butvan.agent.network.record.service.RecordBackupService;
import butvan.agent.network.record.service.RecordTabService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;

/** “资料”模块 HTTP 协议适配层。 */
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/agent/records")
@RequiredArgsConstructor
public class RecordController {
    private final RecordService recordService;
    private final CurrentUserProvider currentUserProvider;
    private final RecordAttachmentService attachmentService;
    private final RecordBackupService backupService;
    private final RecordTabService tabService;

    @ApiLog("查询资料列表")
    @GetMapping
    public Result<List<RecordResponse>> list(@RequestParam LocalDate from, @RequestParam LocalDate to,
                                            @RequestParam(required = false) String type,
                                            @RequestParam(required = false) String tag,
                                            @RequestParam(required = false) String query,
                                            @RequestParam(required = false) String tabId) {
        return Result.success(recordService.search(owner(), from, to, type, tag, query, tabId).stream().map(RecordDtos::from).toList());
    }

    @ApiLog("查询资料日历摘要")
    @GetMapping("/days")
    public Result<List<DaySummaryResponse>> days(@RequestParam LocalDate from, @RequestParam LocalDate to) {
        return Result.success(recordService.summarizeDays(owner(), from, to).stream().map(RecordDtos::from).toList());
    }

    @ApiLog("查询单条资料")
    @GetMapping("/{id}")
    public Result<RecordResponse> get(@PathVariable String id) { return Result.success(RecordDtos.from(recordService.get(owner(), id))); }

    @ApiLog("创建资料")
    @PostMapping
    public Result<RecordResponse> create(@RequestBody SaveRecordRequest request) {
        return Result.success(RecordDtos.from(recordService.create(owner(), command(request))));
    }

    @ApiLog("更新资料")
    @PutMapping("/{id}")
    public Result<RecordResponse> update(@PathVariable String id, @RequestParam int expectedVersion,
                                         @RequestBody SaveRecordRequest request) {
        return Result.success(RecordDtos.from(recordService.update(owner(), id, expectedVersion, command(request))));
    }

    @ApiLog("更新资料展示状态")
    @PatchMapping("/{id}/flags")
    public Result<RecordResponse> flags(@PathVariable String id, @RequestBody UpdateFlagsRequest request) {
        return Result.success(RecordDtos.from(recordService.updateFlags(owner(), id, request.expectedVersion(),
                request.pinned(), request.favorite(), request.archived())));
    }

    @ApiLog("将资料移入回收站")
    @DeleteMapping("/{id}")
    public Result<String> trash(@PathVariable String id, @RequestParam int expectedVersion) {
        recordService.trash(owner(), id, expectedVersion);
        return Result.success("资料已移入回收站");
    }

    @ApiLog("查询资料回收站")
    @GetMapping("/trash")
    public Result<List<RecordResponse>> trash() {
        return Result.success(recordService.trashEntries(owner()).stream().map(RecordDtos::from).toList());
    }

    @ApiLog("从回收站恢复资料")
    @PostMapping("/{id}/restore")
    public Result<RecordResponse> restore(@PathVariable String id, @RequestParam int expectedVersion) {
        return Result.success(RecordDtos.from(recordService.restore(owner(), id, expectedVersion)));
    }

    @ApiLog("清空资料回收站")
    @DeleteMapping("/trash")
    public Result<Integer> clearTrash() { return Result.success(recordService.clearTrash(owner())); }

    @ApiLog("查询资料附件")
    @GetMapping("/{id}/attachments")
    public Result<List<RecordDtos.AttachmentResponse>> attachments(@PathVariable String id) {
        return Result.success(attachmentService.list(owner(), id).stream().map(RecordDtos::from).toList());
    }

    @ApiLog("上传资料附件")
    @PostMapping(value = "/{id}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Result<RecordDtos.AttachmentResponse> upload(@PathVariable String id, @RequestPart("file") MultipartFile file) {
        return Result.success(RecordDtos.from(attachmentService.upload(owner(), id, file)));
    }

    @ApiLog("下载资料附件")
    @GetMapping("/{id}/attachments/{attachmentId}/content")
    public ResponseEntity<Resource> download(@PathVariable String id, @PathVariable String attachmentId) {
        var attachment = attachmentService.get(owner(), id, attachmentId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(attachment.mediaType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename(attachment.originalName(), java.nio.charset.StandardCharsets.UTF_8).build().toString())
                .body(attachmentService.download(owner(), id, attachmentId));
    }

    @ApiLog("删除资料附件")
    @DeleteMapping("/{id}/attachments/{attachmentId}")
    public Result<String> deleteAttachment(@PathVariable String id, @PathVariable String attachmentId) {
        attachmentService.delete(owner(), id, attachmentId);
        return Result.success("附件已删除");
    }

    @ApiLog("导出资料完整备份")
    @GetMapping(value = "/backup", produces = "application/zip")
    public ResponseEntity<byte[]> exportBackup() {
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("application/zip"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=butvan-records-backup.zip")
                .body(backupService.exportBackup(owner()));
    }

    @ApiLog("导入资料完整备份")
    @PostMapping(value = "/backup", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Result<Integer> importBackup(@RequestPart("file") MultipartFile file) {
        return Result.success(backupService.importBackup(owner(), file));
    }

    private RecordCommand command(SaveRecordRequest request) {
        return new RecordCommand(request.recordDate(), RecordType.parse(request.type()), request.title(),
                request.contentHtml() == null ? "" : request.contentHtml(),
                request.contentText() == null ? "" : request.contentText(), request.tags(), request.tabId());
    }

    private String owner() { return currentUserProvider.currentUserId(); }

    @ApiLog("查询资料分类 Tab")
    @GetMapping("/tabs")
    public Result<List<RecordDtos.TabResponse>> tabs() {
        return Result.success(tabService.list(owner()).stream().map(RecordDtos::from).toList());
    }

    @ApiLog("创建自定义资料分类 Tab")
    @PostMapping("/tabs")
    public Result<RecordDtos.TabResponse> createTab(@RequestBody RecordDtos.CreateTabRequest request) {
        return Result.success(RecordDtos.from(tabService.create(owner(), request.name())));
    }

    /**
     * PUT /agent/records/tabs/order：接收当前用户全部 Tab ID 的有序列表并返回排序后的 Tab；
     * ID 缺失、重复或不属于当前用户时返回业务码 400，仅可修改当前登录用户的数据。
     */
    @ApiLog("调整资料分类 Tab 顺序")
    @PutMapping("/tabs/order")
    public Result<List<RecordDtos.TabResponse>> reorderTabs(@RequestBody RecordDtos.ReorderTabsRequest request) {
        return Result.success(tabService.reorder(owner(), request.tabIds()).stream().map(RecordDtos::from).toList());
    }

    @ApiLog("删除自定义资料分类 Tab")
    @DeleteMapping("/tabs/{tabId}")
    public Result<String> deleteTab(@PathVariable String tabId) {
        tabService.delete(owner(), tabId);
        return Result.success("Tab 已删除");
    }
}
