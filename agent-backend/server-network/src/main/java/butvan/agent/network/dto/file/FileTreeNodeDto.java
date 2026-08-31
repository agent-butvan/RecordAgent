package butvan.agent.network.dto.file;

import java.util.List;

/**
 * 项目文件树节点（只读展示用）。
 *
 * <p>仅暴露展示所需的名称、相对路径与类型；不承载文件内容，
 * 目录节点通过 {@link #children()} 挂载子节点。</p>
 *
 * @param name     文件名或目录名
 * @param path     相对项目根目录的路径（统一使用正斜杠）
 * @param type     节点类型：{@code file} 或 {@code dir}
 * @param children 目录节点的子节点列表（文件节点为空列表）
 */
public record FileTreeNodeDto(
        String name,
        String path,
        String type,
        List<FileTreeNodeDto> children) {
}
