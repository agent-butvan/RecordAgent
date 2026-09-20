package butvan.agent.network.service.account;

import butvan.agent.network.file.model.FileAsset;
import butvan.agent.network.file.service.FileAssetService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;

/** 管理本地账户头像，并将图片校验与文件资产生命周期封装在账户领域内。 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccountAvatarService {
    private static final long MAX_FILE_SIZE = 5L * 1024 * 1024;
    private static final int MIN_DIMENSION = 48;
    private static final int MAX_DIMENSION = 4_096;

    private final FileAssetService fileAssetService;

    /** 校验并替换当前用户头像；旧头像在新文件可用后回收。 */
    public FileAsset replace(String ownerId, MultipartFile file) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("请选择头像图片");
        if (file.getSize() > MAX_FILE_SIZE) throw new IllegalArgumentException("头像图片不能超过 5 MB");

        byte[] content = readContent(file);
        ImageFormat format = inspect(content);
        List<FileAsset> previous = list(ownerId);
        FileAsset created = fileAssetService.createAndBind(ownerId, FileAssetService.DOMAIN_ACCOUNT, ownerId,
                FileAssetService.ROLE_AVATAR, normalizedName(file.getOriginalFilename(), format.extension()),
                format.mediaType(), new ByteArrayInputStream(content), MAX_FILE_SIZE);
        previous.forEach(asset -> deletePrevious(ownerId, asset));
        return created;
    }

    /** 返回当前头像；异常历史数据存在多条时以最新上传的文件为准。 */
    public FileAsset current(String ownerId) {
        List<FileAsset> avatars = list(ownerId);
        return avatars.isEmpty() ? null : avatars.getLast();
    }

    public Resource content(String ownerId) {
        FileAsset avatar = requireCurrent(ownerId);
        return new InputStreamResource(fileAssetService.open(ownerId, avatar.id(),
                FileAssetService.DOMAIN_ACCOUNT, ownerId, FileAssetService.ROLE_AVATAR));
    }

    private List<FileAsset> list(String ownerId) {
        return fileAssetService.list(ownerId, FileAssetService.DOMAIN_ACCOUNT, ownerId,
                FileAssetService.ROLE_AVATAR);
    }

    private FileAsset requireCurrent(String ownerId) {
        FileAsset avatar = current(ownerId);
        if (avatar == null) throw new IllegalArgumentException("尚未设置头像");
        return avatar;
    }

    private byte[] readContent(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException exception) {
            throw new IllegalStateException("头像图片读取失败", exception);
        }
    }

    private ImageFormat inspect(byte[] content) {
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(content))) {
            if (input == null) throw new IllegalArgumentException("无法识别头像图片");
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw new IllegalArgumentException("头像仅支持 PNG 或 JPEG 格式");
            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                ImageFormat format = ImageFormat.parse(reader.getFormatName());
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
                    throw new IllegalArgumentException("头像尺寸不能小于 48 × 48 像素");
                }
                if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                    throw new IllegalArgumentException("头像尺寸不能超过 4096 × 4096 像素");
                }
                if (reader.read(0) == null) throw new IllegalArgumentException("头像图片已损坏或无法读取");
                return format;
            } finally {
                reader.dispose();
            }
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (IOException exception) {
            throw new IllegalArgumentException("头像图片已损坏或无法读取");
        }
    }

    private String normalizedName(String originalName, String extension) {
        String name = originalName == null ? "avatar" : originalName.trim();
        int dot = name.lastIndexOf('.');
        String base = dot > 0 ? name.substring(0, dot) : name;
        if (base.isBlank()) base = "avatar";
        return base + "." + extension;
    }

    private void deletePrevious(String ownerId, FileAsset asset) {
        try {
            fileAssetService.unbind(ownerId, asset.id(), FileAssetService.DOMAIN_ACCOUNT, ownerId,
                    FileAssetService.ROLE_AVATAR);
        } catch (RuntimeException exception) {
            log.warn("旧头像回收失败，将保留文件资产供后续清理：fileId={}", asset.id(), exception);
        }
    }

    private record ImageFormat(String mediaType, String extension) {
        private static ImageFormat parse(String formatName) {
            String normalized = formatName == null ? "" : formatName.toLowerCase(Locale.ROOT);
            return switch (normalized) {
                case "png" -> new ImageFormat("image/png", "png");
                case "jpeg", "jpg" -> new ImageFormat("image/jpeg", "jpg");
                default -> throw new IllegalArgumentException("头像仅支持 PNG 或 JPEG 格式");
            };
        }
    }
}
