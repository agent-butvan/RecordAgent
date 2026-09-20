package butvan.agent.network.file.model;

import java.time.Instant;

/** 后端拥有的文件资产元数据；业务模块通过稳定 ID 引用，不接触物理存储路径。 */
public record FileAsset(
        String id,
        String ownerId,
        String originalName,
        String mediaType,
        long sizeBytes,
        String sha256,
        String backendType,
        String storageProfileId,
        String storageKey,
        String status,
        Instant createdAt,
        Instant updatedAt,
        Instant deletedAt) {
}
