package butvan.agent.network.service;

import butvan.agent.network.dto.file.FileTreeNodeDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 项目文件树的只读查询服务（供前端右侧面板展示）。
 *
 * <p>安全边界：仅支持列出目录名与文件名，绝不读取文件内容；
 * 自动跳过常见构建产物、依赖目录与隐藏条目，避免把密钥或
 * 二进制产物暴露给界面；同时限制遍历深度与节点总数。</p>
 */
@Slf4j
@Service
public class FileTreeService {

    /** 始终跳过的目录（构建产物、依赖、IDE 配置、版本库元数据等）。 */
    private static final Set<String> SKIPPED_DIRECTORIES = Set.of(
            ".git", ".svn", ".hg", "node_modules", "target", "dist", "build",
            "out", ".next", ".nuxt", ".cache", "__pycache__", ".pytest_cache",
            ".gradle", "bin", "obj", "coverage", ".venv", "venv", "vendor",
            ".terraform", ".idea", ".vscode", ".DS_Store");

    /** 始终跳过的文件（系统元数据）。 */
    private static final Set<String> SKIPPED_FILES = Set.of(
            ".DS_Store", "Thumbs.db", "desktop.ini");

    /** 隐藏条目白名单：这些隐藏目录对开发工作流有意义，允许展示。 */
    private static final Set<String> ALLOWED_HIDDEN_DIRECTORIES = Set.of(".github");

    /** 允许的最大遍历深度（调用方可传入 1..{@link #MAX_DEPTH}）。 */
    private static final int MAX_DEPTH = 6;

    /** 单次查询的节点总数上限，防止超大仓库拖垮接口。 */
    private static final int MAX_NODES = 1500;

    /**
     * 列出项目根目录下的文件树。
     *
     * @param rawPath 项目根目录绝对路径
     * @param depth   期望深度（1 到 {@link #MAX_DEPTH}，默认 3）
     * @return 排序后的顶层节点列表（目录优先、名称不区分大小写）
     */
    public List<FileTreeNodeDto> list(String rawPath, int depth) {
        if (rawPath == null || rawPath.isBlank()) {
            throw new IllegalArgumentException("项目路径不能为空");
        }
        Path root = Paths.get(rawPath).toAbsolutePath().normalize();
        if (!Files.isDirectory(root)) {
            throw new IllegalArgumentException("项目目录不存在或不可访问：" + root);
        }

        int effectiveDepth = Math.max(1, Math.min(depth, MAX_DEPTH));
        AtomicInteger nodeCount = new AtomicInteger(0);
        try {
            return buildTree(root, root, effectiveDepth, nodeCount);
        } catch (IOException e) {
            log.error("读取项目文件树失败: root={}", root, e);
            throw new IllegalArgumentException("读取项目文件树失败，请稍后重试");
        }
    }

    /**
     * 递归构建目录树。相对路径基于项目根目录计算，统一使用正斜杠。
     */
    private List<FileTreeNodeDto> buildTree(
            Path root, Path dir, int remainingDepth, AtomicInteger nodeCount) throws IOException {
        if (remainingDepth <= 0 || nodeCount.get() >= MAX_NODES) {
            return List.of();
        }

        List<FileTreeNodeDto> nodes = new ArrayList<>();
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(dir)) {
            for (Path entry : stream) {
                if (nodeCount.get() >= MAX_NODES) {
                    break;
                }
                Path fileNamePath = entry.getFileName();
                if (fileNamePath == null) {
                    continue;
                }
                String name = fileNamePath.toString();
                if (isSkipped(name, Files.isDirectory(entry))) {
                    continue;
                }

                String relativePath = toRelativePath(root, entry);
                if (Files.isDirectory(entry)) {
                    List<FileTreeNodeDto> children;
                    try {
                        children = buildTree(root, entry, remainingDepth - 1, nodeCount);
                    } catch (IOException e) {
                        // 单个子目录不可读时跳过该目录，不中断整棵树
                        log.warn("跳过不可读取的子目录: {}", entry, e);
                        children = List.of();
                    }
                    nodeCount.incrementAndGet();
                    nodes.add(new FileTreeNodeDto(name, relativePath, "dir", children));
                } else {
                    nodeCount.incrementAndGet();
                    nodes.add(new FileTreeNodeDto(name, relativePath, "file", List.of()));
                }
            }
        }

        nodes.sort(Comparator
                .comparing((FileTreeNodeDto node) -> "dir".equals(node.type()) ? 0 : 1)
                .thenComparing(node -> node.name().toLowerCase(Locale.ROOT)));
        return nodes;
    }

    /** 隐藏条目（点开头）默认跳过，仅白名单目录可见；元数据文件与产物目录一律跳过。 */
    private boolean isSkipped(String name, boolean isDirectory) {
        if (SKIPPED_FILES.contains(name) || SKIPPED_DIRECTORIES.contains(name)) {
            return true;
        }
        if (name.startsWith(".")) {
            return !(isDirectory && ALLOWED_HIDDEN_DIRECTORIES.contains(name));
        }
        return false;
    }

    /** 计算条目相对项目根目录的路径，统一使用正斜杠分隔。 */
    private String toRelativePath(Path root, Path entry) {
        return root.relativize(entry).toString().replace('\\', '/');
    }
}
