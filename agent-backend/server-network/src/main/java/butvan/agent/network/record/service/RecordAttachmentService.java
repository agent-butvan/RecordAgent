package butvan.agent.network.record.service;

import butvan.agent.network.config.database.LocalDatabaseProperties;
import butvan.agent.network.record.model.RecordModels.RecordAttachment;
import butvan.agent.network.record.repository.RecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** 在记录领域接口后封装附件文件与 SQLite 元数据的一致性。 */
@Service
@RequiredArgsConstructor
public class RecordAttachmentService {
    private static final long MAX_FILE_SIZE = 25L * 1024 * 1024;
    private final RecordRepository repository;
    private final LocalDatabaseProperties databaseProperties;

    /** 上传单个附件；图片、PDF 和普通文件均保留原始 MIME 类型。 */
    public RecordAttachment upload(String ownerId, String recordId, MultipartFile file) {
        repository.find(ownerId, recordId).orElseThrow(() -> new IllegalArgumentException("资料不存在"));
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("附件不能为空");
        if (file.getSize() > MAX_FILE_SIZE) throw new IllegalArgumentException("单个附件不能超过 25 MB");
        String id = UUID.randomUUID().toString();
        String originalName = Path.of(file.getOriginalFilename() == null ? "附件" : file.getOriginalFilename()).getFileName().toString();
        String storedName = id + extension(originalName);
        Path target = attachmentRoot().resolve(storedName).normalize();
        try {
            Files.createDirectories(attachmentRoot());
            file.transferTo(target);
        } catch (IOException exception) {
            throw new IllegalStateException("附件保存失败", exception);
        }
        RecordAttachment attachment = new RecordAttachment(id, recordId, originalName, storedName,
                file.getContentType() == null ? "application/octet-stream" : file.getContentType(), file.getSize(), Instant.now());
        try { repository.insertAttachment(attachment); }
        catch (RuntimeException exception) { try { Files.deleteIfExists(target); } catch (IOException ignored) { /* 保留原始数据库异常 */ } throw exception; }
        return attachment;
    }

    public List<RecordAttachment> list(String ownerId, String recordId) { return repository.findAttachments(ownerId, recordId); }

    /** 读取附件前验证记录所有权。 */
    public Resource download(String ownerId, String recordId, String attachmentId) {
        RecordAttachment attachment = get(ownerId, recordId, attachmentId);
        try { return new UrlResource(attachmentRoot().resolve(attachment.storedName()).toUri()); }
        catch (IOException exception) { throw new IllegalStateException("附件读取失败", exception); }
    }

    public RecordAttachment get(String ownerId, String recordId, String attachmentId) {
        return repository.findAttachment(ownerId, recordId, attachmentId).orElseThrow(() -> new IllegalArgumentException("附件不存在"));
    }

    /** 删除附件文件和元数据。 */
    public void delete(String ownerId, String recordId, String attachmentId) {
        RecordAttachment attachment = get(ownerId, recordId, attachmentId);
        if (!repository.deleteAttachment(ownerId, recordId, attachmentId)) throw new IllegalArgumentException("附件不存在");
        try { Files.deleteIfExists(attachmentRoot().resolve(attachment.storedName())); }
        catch (IOException exception) { throw new IllegalStateException("附件文件删除失败", exception); }
    }

    public Path pathOf(RecordAttachment attachment) { return attachmentRoot().resolve(attachment.storedName()); }

    /** 从可信备份内容恢复附件，并重新生成本地存储名。 */
    public RecordAttachment restore(String ownerId, String recordId, String originalName, String mediaType, byte[] bytes) {
        repository.find(ownerId, recordId).orElseThrow(() -> new IllegalArgumentException("资料不存在"));
        String id = UUID.randomUUID().toString();
        String safeName = Path.of(originalName == null ? "附件" : originalName).getFileName().toString();
        String storedName = id + extension(safeName);
        try {
            Files.createDirectories(attachmentRoot());
            Files.write(attachmentRoot().resolve(storedName), bytes);
        } catch (IOException exception) { throw new IllegalStateException("备份附件恢复失败", exception); }
        RecordAttachment attachment = new RecordAttachment(id, recordId, safeName, storedName,
                mediaType == null ? "application/octet-stream" : mediaType, bytes.length, Instant.now());
        repository.insertAttachment(attachment);
        return attachment;
    }

    private Path attachmentRoot() { return databaseProperties.getPath().toAbsolutePath().normalize().getParent().resolve("records/attachments"); }
    private String extension(String name) { int dot = name.lastIndexOf('.'); return dot < 0 ? "" : name.substring(dot).replaceAll("[^A-Za-z0-9.]", ""); }
}
