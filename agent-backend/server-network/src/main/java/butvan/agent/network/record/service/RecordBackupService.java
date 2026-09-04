package butvan.agent.network.record.service;

import butvan.agent.network.record.model.RecordModels.RecordAttachment;
import butvan.agent.network.record.model.RecordModels.RecordCommand;
import butvan.agent.network.record.model.RecordModels.RecordEntry;
import butvan.agent.network.record.model.RecordModels.RecordTab;
import butvan.agent.network.record.repository.RecordRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.zip.*;

/** 将记录、标签、富文本、Markdown 与附件封装为可迁移的 ZIP 备份。 */
@Service
@RequiredArgsConstructor
public class RecordBackupService {
    private static final long MAX_BACKUP_SIZE = 512L * 1024 * 1024;
    private final RecordRepository repository;
    private final RecordService recordService;
    private final RecordAttachmentService attachmentService;
    private final RecordTabService tabService;
    private final ObjectMapper objectMapper;

    public record BackupItem(RecordEntry record, List<RecordAttachment> attachments) { }
    public record BackupManifest(int formatVersion, List<RecordTab> tabs, List<BackupItem> items) { }

    /** 导出完整可恢复清单，并附带人类可读 Markdown 和原始附件。 */
    public byte[] exportBackup(String ownerId) {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream(); ZipOutputStream zip = new ZipOutputStream(output)) {
            List<BackupItem> items = repository.findAll(ownerId).stream()
                    .map(record -> new BackupItem(record, attachmentService.list(ownerId, record.id()))).toList();
            put(zip, "manifest.json", objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(new BackupManifest(2, tabService.list(ownerId), items)));
            for (BackupItem item : items) {
                RecordEntry record = item.record();
                String title = record.title() == null ? record.contentText().lines().findFirst().orElse("无标题") : record.title();
                String markdown = "# " + title + "\n\n- 日期：" + record.recordDate() + "\n- 类型：" + record.type().value()
                        + "\n- 标签：" + String.join("、", record.tags()) + "\n\n" + record.contentText() + "\n";
                put(zip, "markdown/" + record.recordDate() + "-" + record.id() + ".md", markdown.getBytes(StandardCharsets.UTF_8));
                for (RecordAttachment attachment : item.attachments()) {
                    put(zip, "attachments/" + record.id() + "/" + attachment.id(), Files.readAllBytes(attachmentService.pathOf(attachment)));
                }
            }
            zip.finish(); return output.toByteArray();
        } catch (IOException exception) { throw new IllegalStateException("记录备份导出失败", exception); }
    }

    /** 校验备份后用其替换当前用户的记录资料库。 */
    @Transactional
    public int importBackup(String ownerId, MultipartFile file) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("请选择备份文件");
        if (file.getSize() > MAX_BACKUP_SIZE) throw new IllegalArgumentException("备份文件不能超过 512 MB");
        try {
            Map<String, byte[]> entries = unzip(file.getBytes());
            byte[] manifestBytes = entries.get("manifest.json");
            if (manifestBytes == null) throw new IllegalArgumentException("备份缺少 manifest.json");
            BackupManifest manifest = objectMapper.readValue(manifestBytes, BackupManifest.class);
            if ((manifest.formatVersion() != 1 && manifest.formatVersion() != 2) || manifest.items() == null) throw new IllegalArgumentException("不支持的备份格式");
            for (BackupItem item : manifest.items()) {
                if (item == null || item.record() == null) throw new IllegalArgumentException("备份记录结构不完整");
                for (RecordAttachment attachment : item.attachments() == null ? List.<RecordAttachment>of() : item.attachments()) {
                    if (!entries.containsKey("attachments/" + item.record().id() + "/" + attachment.id())) {
                        throw new IllegalArgumentException("备份中的附件不完整");
                    }
                }
            }
            recordService.clearAllForImport(ownerId);
            Map<String, String> tabIds = new HashMap<>();
            List<RecordTab> currentTabs = tabService.list(ownerId);
            for (RecordTab sourceTab : manifest.tabs() == null ? List.<RecordTab>of() : manifest.tabs()) {
                RecordTab target = sourceTab.systemKey() == null
                        ? currentTabs.stream().filter(tab -> tab.systemKey() == null && tab.name().equals(sourceTab.name())).findFirst()
                            .orElseGet(() -> tabService.create(ownerId, sourceTab.name()))
                        : currentTabs.stream().filter(tab -> sourceTab.systemKey().equals(tab.systemKey())).findFirst().orElse(null);
                if (target != null) tabIds.put(sourceTab.id(), target.id());
            }
            int imported = 0;
            for (BackupItem item : manifest.items()) {
                RecordEntry source = item.record();
                RecordEntry restored = recordService.create(ownerId, new RecordCommand(source.recordDate(), source.type(),
                        source.title(), source.contentHtml(), source.contentText(), source.tags(), tabIds.get(source.tabId())));
                if (source.pinned() || source.favorite() || source.archived()) {
                    restored = recordService.updateFlags(ownerId, restored.id(), restored.version(), source.pinned(), source.favorite(), source.archived());
                }
                if (source.trashedAt() != null) recordService.trash(ownerId, restored.id(), restored.version());
                for (RecordAttachment attachment : item.attachments() == null ? List.<RecordAttachment>of() : item.attachments()) {
                    byte[] content = entries.get("attachments/" + source.id() + "/" + attachment.id());
                    if (content == null) throw new IllegalArgumentException("备份中的附件不完整");
                    attachmentService.restore(ownerId, restored.id(), attachment.originalName(), attachment.mediaType(), content);
                }
                imported++;
            }
            return imported;
        } catch (IllegalArgumentException exception) { throw exception; }
        catch (IOException exception) { throw new IllegalArgumentException("备份文件无法读取"); }
    }

    private Map<String, byte[]> unzip(byte[] bytes) throws IOException {
        Map<String, byte[]> result = new HashMap<>(); long total = 0;
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (entry.isDirectory() || entry.getName().contains("..") || entry.getName().startsWith("/")) continue;
                byte[] content = zip.readAllBytes(); total += content.length;
                if (total > MAX_BACKUP_SIZE) throw new IllegalArgumentException("备份解压后过大");
                result.put(entry.getName(), content);
            }
        }
        return result;
    }

    private void put(ZipOutputStream zip, String name, byte[] bytes) throws IOException {
        zip.putNextEntry(new ZipEntry(name)); zip.write(bytes); zip.closeEntry();
    }
}
