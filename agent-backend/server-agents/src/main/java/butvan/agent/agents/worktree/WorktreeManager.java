package butvan.agent.agents.worktree;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

/**
 * Git Worktree 生命周期管理：创建、列出、删除、变更检测、过期清理
 *
 *
 */
public class WorktreeManager {

    private static final Pattern SEGMENT = Pattern.compile("^[a-zA-Z0-9._-]+$");
    private static final int MAX_NAME_LENGTH = 64;
    private static final int GIT_TIMEOUT_SECONDS = 60;

    private final Path repoRoot;
    private final Path worktreeDir;
    private final Map<String, WorktreeInfo> active = new LinkedHashMap<>();

    /**
     * @param repoRoot     主仓库路径（worktree 从哪个仓库创建）
     * @param worktreeDir  所有 worktree 的存放目录（如 {repoRoot}/.butvan-agent/worktrees）
     */
    public WorktreeManager(Path repoRoot, Path worktreeDir) {
        this.repoRoot = repoRoot;
        this.worktreeDir = worktreeDir;
    }


    /**
     * 校验。slug：允许字母数字，_，可含 / 分段，拒绝 . 与 。。 独立段
     * @param name
     * @return
     */
    public static String validateSlug(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("worktree name cannot be empty");
        }
        if (name.length() > MAX_NAME_LENGTH) {
            throw new IllegalArgumentException("worktree name too long: " + name);
        }
        for (String seg : name.split("/")) {
            if (seg.equals(".") || seg.equals("..")) {
                throw new IllegalArgumentException("worktree name must not contain . or ..");
            }
            if (!SEGMENT.matcher(seg).matches()) {
                throw new IllegalArgumentException("invalid worktree segment:" + seg);
            }
        }
        return name;
    }

    public synchronized WorktreeInfo create(String name, String baseBranch) throws Exception {
        validateSlug(name);

        if (active.containsKey(name)) {
            throw new IllegalArgumentException("worktree already exists:" + name);
        }
        Files.createDirectories(worktreeDir);
        String flatSlug = name.replace("/", "+");
        String branch = "worktree-" + flatSlug;
        Path wtPath = worktreeDir.resolve(flatSlug);
        String base = baseBranch == null || baseBranch.isBlank() ? "HEAD" : baseBranch;

        // 快速恢复：目录已存在则直接复用，不调用git
        String head = readHeadSha(wtPath);
        if (head != null) {
            WorktreeInfo info = new WorktreeInfo(name, wtPath, branch, head, Instant.now());
            active.put(name, info);
            return info;
        }

        runGit(repoRoot, "git", "worktree", "add", "-B", branch,
                wtPath.toString(), base);
        WorktreeInfo info = new WorktreeInfo(name, wtPath, branch,
                resolveHead(wtPath), Instant.now());
        active.put(name, info);
        return info;

    }

    private String resolveHead(Path wtPath) throws Exception {
        String ref = Files.readString(wtPath.resolve(".git"), StandardCharsets.UTF_8);
        if (ref.startsWith("gitdir:")) {
            Path gitdir = wtPath.resolve(ref.substring("gitdir:".length()).strip());
            String head = Files.readString(gitdir.resolve("HEAD"), StandardCharsets.UTF_8).strip();
            if (head.startsWith("ref:")) {
                Path refPath = gitdir.resolve(head.substring("ref:".length()).strip());
                if (Files.isRegularFile(refPath)) {
                    return Files.readString(refPath, StandardCharsets.UTF_8).strip();
                }
            }
            return head;
        }
        return Files.readString(wtPath.resolve(".git/HEAD"), StandardCharsets.UTF_8).strip();
    }

    /** 快速恢复用：不调 git，直接读 .git 指针与 HEAD。返回 null 表示目录不存在或不可用。 */
    private String readHeadSha(Path wtPath) {
        try {
            return resolveHead(wtPath);
        } catch (Exception e) {
            return null;
        }
    }

    private static String runGit(Path workDir, String... cmd) throws Exception {
        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.directory(workDir.toFile());
        pb.redirectErrorStream(true);
        pb.environment().put("GIT_TERMINAL_PROMPT", "0");
        pb.environment().put("GIT_ASKPASS", "");
        pb.redirectInput(ProcessBuilder.Redirect.PIPE);
        Process p = pb.start();
        p.getOutputStream().close(); // 关闭 stdin，防止交互命令挂起
        String output;
        try (var in = p.getInputStream()) {
            output = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
        if (!p.waitFor(GIT_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
            p.destroyForcibly();
            throw new IOException("git command timed out: " + String.join(" ", cmd));
        }
        if (p.exitValue() != 0) {
            throw new IOException(String.join(" ", cmd) + ": " + output);
        }
        return output;
    }
}
