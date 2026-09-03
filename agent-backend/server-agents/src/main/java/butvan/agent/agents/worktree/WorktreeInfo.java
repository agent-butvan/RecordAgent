package butvan.agent.agents.worktree;

import java.nio.file.Path;
import java.time.Instant;

/**
 * Worktree 实例信息
 * @param name 业务名称
 * @param path 磁盘路径
 * @param branch git 分之
 * @param headCommit 创建时的 HEAD commit
 * @param createAt 创建时间
 */
public record WorktreeInfo(
        String name,
        Path path,
        String branch,
        String headCommit,
        Instant createAt
) {
}
