package butvan.agent.network.record.service;

import butvan.agent.network.file.model.FileAsset;
import butvan.agent.network.file.service.FileAssetService;
import butvan.agent.network.record.model.RecordModels.RecordAttachment;
import butvan.agent.network.record.repository.RecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.List;

/** 将资料附件语义适配到通用文件资产模块，并保持既有资料接口稳定。 */
@Service
@RequiredArgsConstructor
public class RecordAttachmentService {
    private static final long MAX_FILE_SIZE = 25L * 1024 * 1024;
    private final RecordRepository repository;
    private final FileAssetService fileAssetService;

    /** 上传单个附件；图片、PDF 和普通文件均保留原始 MIME 类型。 */
    public RecordAttachment upload(String ownerId, String recordId, MultipartFile file) {
        repository.find(ownerId, recordId).orElseThrow(() -> new IllegalArgumentException("资料不存在"));
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("附件不能为空");
        if (file.getSize() > MAX_FILE_SIZE) throw new IllegalArgumentException("单个附件不能超过 25 MB");
        try {
            FileAsset asset = fileAssetService.createAndBind(ownerId, FileAssetService.DOMAIN_RECORD, recordId,
                    FileAssetService.ROLE_ATTACHMENT, file.getOriginalFilename(), file.getContentType(),
                    file.getInputStream(), MAX_FILE_SIZE);
            return toAttachment(recordId, asset);
        } catch (IOException exception) {
            throw new IllegalStateException("附件内容读取失败", exception);
        }
    }

    public List<RecordAttachment> list(String ownerId, String recordId) {
        repository.find(ownerId, recordId).orElseThrow(() -> new IllegalArgumentException("资料不存在"));
        return fileAssetService.list(ownerId, FileAssetService.DOMAIN_RECORD, recordId,
                FileAssetService.ROLE_ATTACHMENT).stream().map(asset -> toAttachment(recordId, asset)).toList();
    }

    /** 读取附件前验证记录所有权。 */
    public Resource download(String ownerId, String recordId, String attachmentId) {
        return new InputStreamResource(fileAssetService.open(ownerId, attachmentId,
                FileAssetService.DOMAIN_RECORD, recordId, FileAssetService.ROLE_ATTACHMENT));
    }

    public RecordAttachment get(String ownerId, String recordId, String attachmentId) {
        return toAttachment(recordId, fileAssetService.get(ownerId, attachmentId,
                FileAssetService.DOMAIN_RECORD, recordId, FileAssetService.ROLE_ATTACHMENT));
    }

    /** 删除附件文件和元数据。 */
    public void delete(String ownerId, String recordId, String attachmentId) {
        fileAssetService.unbind(ownerId, attachmentId, FileAssetService.DOMAIN_RECORD, recordId,
                FileAssetService.ROLE_ATTACHMENT);
    }

    /** 删除一条资料的全部附件，供永久删除与导入替换流程回收文件。 */
    public void deleteAll(String ownerId, String recordId) {
        for (RecordAttachment attachment : list(ownerId, recordId)) delete(ownerId, recordId, attachment.id());
    }

    /** 读取附件原始内容，供版本化备份使用。 */
    public byte[] readAllBytes(String ownerId, String recordId, String attachmentId) {
        return fileAssetService.readAllBytes(ownerId, attachmentId, FileAssetService.DOMAIN_RECORD, recordId,
                FileAssetService.ROLE_ATTACHMENT);
    }

    /** 从可信备份内容恢复附件，并重新生成本地存储名。 */
    public RecordAttachment restore(String ownerId, String recordId, String originalName, String mediaType, byte[] bytes) {
        repository.find(ownerId, recordId).orElseThrow(() -> new IllegalArgumentException("资料不存在"));
        if (bytes == null || bytes.length == 0) throw new IllegalArgumentException("备份附件不能为空");
        if (bytes.length > MAX_FILE_SIZE) throw new IllegalArgumentException("单个附件不能超过 25 MB");
        FileAsset asset = fileAssetService.createAndBind(ownerId, FileAssetService.DOMAIN_RECORD, recordId,
                FileAssetService.ROLE_ATTACHMENT, originalName, mediaType, new ByteArrayInputStream(bytes),
                MAX_FILE_SIZE);
        return toAttachment(recordId, asset);
    }

    private RecordAttachment toAttachment(String recordId, FileAsset asset) {
        return new RecordAttachment(asset.id(), recordId, asset.originalName(), asset.storageKey(),
                asset.mediaType(), asset.sizeBytes(), asset.createdAt());
    }
}
