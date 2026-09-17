package butvan.agent.agents.context;

import butvan.agent.agents.storage.AgentStorageProperties;
import butvan.agent.agents.usage.TokenCounter;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * 画像辅助维护的唯一业务入口。
 *
 * <p>本模块只生成待审核提案，只有用户显式确认后才会写入 PROFILE.md。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProfileMaintenanceService {

    private static final int MAX_MEMORY_FILES = 128;
    private static final int EVIDENCE_TOKEN_BUDGET = 1_200;
    private static final int PROFILE_TOKEN_BUDGET = 600;
    private static final int MAX_HISTORY_FILES = 20;
    private static final long MAX_FILE_BYTES = 1_000_000;
    private static final Duration AUTO_CHECK_INTERVAL = Duration.ofHours(24);
    private static final Pattern USER_PROFILE_SECTION = Pattern.compile(
            "(?ms)^##\\s+User Profile\\s*$\\R.*?(?=^##\\s+|\\z)");
    private static final DateTimeFormatter HISTORY_TIME = DateTimeFormatter
            .ofPattern("yyyyMMdd-HHmmss").withZone(ZoneOffset.UTC);

    private final AgentStorageProperties storageProperties;
    private final PersonalContextService personalContextService;
    private final ProfileProposalGenerator proposalGenerator;
    private final TokenCounter tokenCounter;
    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<String, Object> userLocks = new ConcurrentHashMap<>();

    /** 返回当前开关、最近检查结果和唯一待审核提案。 */
    public ProfileMaintenanceSnapshot status(String userId) {
        synchronized (lockFor(userId)) {
            PersonalContextProfile profile = personalContextService.get(userId);
            MaintenanceState state = readState(userId);
            return new ProfileMaintenanceSnapshot(profile.maintenanceEnabled(), profile.revision(),
                    state.lastCheckedAt(), state.lastResult(), readProposal(userId));
        }
    }

    /** 修改辅助维护开关；关闭不会删除画像、提案或历史。 */
    public ProfileMaintenanceSnapshot setEnabled(String userId, boolean enabled) {
        synchronized (lockFor(userId)) {
            personalContextService.setMaintenanceEnabled(userId, enabled);
            return status(userId);
        }
    }

    /** 用户主动要求检查；已有提案时直接返回，避免覆盖尚未审核的内容。 */
    public ProfileMaintenanceSnapshot checkNow(String userId) {
        synchronized (lockFor(userId)) {
            if (readProposal(userId) != null) return status(userId);
            generateProposal(userId);
            return status(userId);
        }
    }

    /** 聊天完成后的低频检查入口；未开启、无新记忆或 24 小时内已检查时不调用模型。 */
    public void checkIfDue(String userId) {
        synchronized (lockFor(userId)) {
            PersonalContextProfile profile = personalContextService.get(userId);
            if (!profile.maintenanceEnabled() || readProposal(userId) != null) return;
            MaintenanceState state = readState(userId);
            EvidenceBundle bundle = collectEvidence(userId);
            boolean recentlyChecked = state.lastCheckedAt() != null
                    && state.lastCheckedAt().isAfter(Instant.now().minus(AUTO_CHECK_INTERVAL));
            if (recentlyChecked || bundle.fingerprint().equals(state.lastCheckedMemoryFingerprint())) return;
            generateProposal(userId, bundle);
        }
    }

    /** 确认提案；revision 不一致时拒绝覆盖用户在审核期间的手工编辑。 */
    public PersonalContextProfile accept(
            String userId,
            String proposalId,
            String expectedRevision,
            String editedProfile
    ) {
        synchronized (lockFor(userId)) {
            ProfileProposal proposal = requireProposal(userId, proposalId);
            PersonalContextProfile current = personalContextService.get(userId);
            if (!current.revision().equals(expectedRevision)
                    || !current.revision().equals(proposal.baseRevision())) {
                throw new IllegalStateException("个人画像已发生变化，请重新检查后再确认");
            }
            String target = editedProfile == null ? proposal.proposedProfile() : editedProfile.strip();
            validateProfile(target);
            archiveCurrentProfile(userId, current);
            PersonalContextProfile saved = personalContextService.save(userId, target);
            deleteProposal(userId);
            writeState(userId, new MaintenanceState(proposal.memoryFingerprint(), Instant.now(), "accepted"));
            return saved;
        }
    }

    /** 拒绝提案但保留当前画像；同一批记忆不会在下一轮自动重复生成。 */
    public ProfileMaintenanceSnapshot reject(String userId, String proposalId) {
        synchronized (lockFor(userId)) {
            ProfileProposal proposal = requireProposal(userId, proposalId);
            deleteProposal(userId);
            writeState(userId, new MaintenanceState(proposal.memoryFingerprint(), Instant.now(), "rejected"));
            return status(userId);
        }
    }

    private void generateProposal(String userId) {
        generateProposal(userId, collectEvidence(userId));
    }

    private void generateProposal(String userId, EvidenceBundle bundle) {
        if (bundle.evidence().isEmpty()) {
            writeState(userId, new MaintenanceState(bundle.fingerprint(), Instant.now(), "no_evidence"));
            return;
        }
        PersonalContextProfile current = personalContextService.get(userId);
        if (tokenCounter.count(current.content()) > PROFILE_TOKEN_BUDGET) {
            writeState(userId, new MaintenanceState(
                    bundle.fingerprint(), Instant.now(), "profile_too_large"));
            return;
        }
        ProfileGenerationResult generated;
        try {
            generated = proposalGenerator.generate(
                    new ProfileGenerationRequest(current.content(), bundle.evidence()));
            if (generated == null) throw new IllegalArgumentException("模型未返回画像提案");
            if (generated.proposedProfile().equals(current.content()) || generated.changes().isEmpty()) {
                writeState(userId, new MaintenanceState(bundle.fingerprint(), Instant.now(), "no_changes"));
                return;
            }
            validateGenerated(generated, bundle.evidence());
        } catch (RuntimeException exception) {
            recordFailure(userId, bundle.fingerprint());
            throw exception;
        }
        ProfileProposal proposal = new ProfileProposal(
                UUID.randomUUID().toString(),
                current.revision(),
                bundle.fingerprint(),
                Instant.now(),
                generated.summary(),
                generated.proposedProfile(),
                generated.changes());
        writeJson(storageProperties.personalContextPendingProposalFile(userId), proposal);
        writeState(userId, new MaintenanceState(bundle.fingerprint(), Instant.now(), "proposal_ready"));
    }

    private EvidenceBundle collectEvidence(String userId) {
        Path workspace = storageProperties.userWorkspaceDirectory(userId);
        List<ProfileGenerationRequest.MemoryEvidence> evidence = new ArrayList<>();
        StringBuilder fingerprintMaterial = new StringBuilder();
        int remaining = EVIDENCE_TOKEN_BUDGET;
        for (Path path : memoryFiles(workspace)) {
            String content = readSmallFile(path);
            if (content == null) continue;
            if (path.getFileName().toString().equals("MEMORY.md")) {
                content = USER_PROFILE_SECTION.matcher(content).replaceFirst("");
            }
            String relative = workspace.relativize(path).toString().replace('\\', '/');
            fingerprintMaterial.append(relative).append('\n').append(content).append('\n');
            for (String paragraph : content.split("\\R\\s*\\R")) {
                String normalized = paragraph.strip();
                if (normalized.isBlank() || PersonalContextSafety.containsSensitive(normalized)) continue;
                String bounded = truncate(normalized, remaining);
                if (bounded.isBlank()) continue;
                String sourceId = relative + "#" + shortHash(normalized);
                evidence.add(new ProfileGenerationRequest.MemoryEvidence(sourceId, bounded));
                remaining -= tokenCounter.count(bounded);
                if (remaining <= 0) break;
            }
            if (remaining <= 0) break;
        }
        return new EvidenceBundle(List.copyOf(evidence), shortHash(fingerprintMaterial.toString()));
    }

    private List<Path> memoryFiles(Path workspace) {
        List<Path> paths = new ArrayList<>();
        Path memoryDirectory = workspace.resolve("memory");
        if (Files.isDirectory(memoryDirectory) && !Files.isSymbolicLink(memoryDirectory)) {
            try (Stream<Path> stream = Files.list(memoryDirectory)) {
                stream.filter(Files::isRegularFile)
                        .filter(path -> !Files.isSymbolicLink(path))
                        .filter(path -> path.getFileName().toString().endsWith(".md"))
                        .sorted(Comparator.comparing(Path::getFileName).reversed())
                        .limit(MAX_MEMORY_FILES - 1L)
                        .forEach(paths::add);
            } catch (IOException exception) {
                log.warn("读取画像维护记忆目录失败：directory={}", memoryDirectory, exception);
            }
        }
        Path summary = workspace.resolve("MEMORY.md");
        if (Files.isRegularFile(summary) && !Files.isSymbolicLink(summary)) paths.add(summary);
        return paths;
    }

    private void validateGenerated(
            ProfileGenerationResult generated,
            List<ProfileGenerationRequest.MemoryEvidence> evidence
    ) {
        validateProfile(generated.proposedProfile());
        if (generated.changes().size() > 20 || generated.summary().length() > 500) {
            throw new IllegalArgumentException("画像提案内容过长");
        }
        if (PersonalContextSafety.containsSensitive(generated.summary())) {
            throw new IllegalArgumentException("画像提案包含敏感内容");
        }
        if (tokenCounter.count(generated.proposedProfile()) > ContextRequest.DEFAULT_PROFILE_BUDGET) {
            throw new IllegalArgumentException("自动生成的个人画像超过 300 Token 上限");
        }
        Set<String> allowedSources = evidence.stream()
                .map(ProfileGenerationRequest.MemoryEvidence::sourceId)
                .collect(java.util.stream.Collectors.toSet());
        for (ProfileChange change : generated.changes()) {
            if (change.reason().isBlank() || change.sourceIds().isEmpty()
                    || !allowedSources.containsAll(change.sourceIds())) {
                throw new IllegalArgumentException("画像提案缺少可验证的记忆依据");
            }
            if (change.confidence() < 0.7) {
                throw new IllegalArgumentException("画像提案置信度不足");
            }
            if (PersonalContextSafety.containsSensitive(change.before())
                    || PersonalContextSafety.containsSensitive(change.after())
                    || PersonalContextSafety.containsSensitive(change.section())
                    || PersonalContextSafety.containsSensitive(change.reason())) {
                throw new IllegalArgumentException("画像提案包含敏感内容");
            }
        }
    }

    private void validateProfile(String profile) {
        if (profile.length() > PersonalContextService.MAX_PROFILE_CHARS) {
            throw new IllegalArgumentException("个人画像不能超过 "
                    + PersonalContextService.MAX_PROFILE_CHARS + " 个字符");
        }
        if (PersonalContextSafety.containsSensitive(profile)) {
            throw new IllegalArgumentException("个人画像不能包含密码、密钥或其他敏感内容");
        }
    }

    private ProfileProposal requireProposal(String userId, String proposalId) {
        ProfileProposal proposal = readProposal(userId);
        if (proposal == null || proposalId == null || !proposal.id().equals(proposalId)) {
            throw new IllegalArgumentException("待审核画像提案不存在或已失效");
        }
        return proposal;
    }

    private ProfileProposal readProposal(String userId) {
        return readJson(storageProperties.personalContextPendingProposalFile(userId), ProfileProposal.class);
    }

    private MaintenanceState readState(String userId) {
        MaintenanceState state = readJson(storageProperties.personalContextMaintenanceFile(userId),
                MaintenanceState.class);
        return state == null ? MaintenanceState.empty() : state;
    }

    private void writeState(String userId, MaintenanceState state) {
        writeJson(storageProperties.personalContextMaintenanceFile(userId), state);
    }

    private void recordFailure(String userId, String fingerprint) {
        try {
            writeState(userId, new MaintenanceState(fingerprint, Instant.now(), "failed"));
        } catch (RuntimeException persistenceFailure) {
            log.warn("记录画像维护失败退避状态时发生异常：userId={}", userId, persistenceFailure);
        }
    }

    private <T> T readJson(Path path, Class<T> type) {
        try {
            if (Files.isSymbolicLink(path) || !Files.isRegularFile(path)
                    || Files.size(path) > MAX_FILE_BYTES) return null;
            return objectMapper.readValue(path.toFile(), type);
        } catch (IOException exception) {
            log.warn("读取画像维护文件失败，按空状态处理：path={}", path, exception);
            return null;
        }
    }

    private void writeJson(Path path, Object value) {
        try {
            writeAtomically(path, objectMapper.writeValueAsString(value));
        } catch (IOException exception) {
            throw new IllegalStateException("序列化画像维护数据失败", exception);
        }
    }

    private String readSmallFile(Path path) {
        try {
            if (Files.isSymbolicLink(path) || !Files.isRegularFile(path)
                    || Files.size(path) > MAX_FILE_BYTES) return null;
            return Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            log.warn("读取画像维护记忆失败：path={}", path, exception);
            return null;
        }
    }

    private void archiveCurrentProfile(String userId, PersonalContextProfile current) {
        if (current.content().isBlank()) return;
        Path directory = storageProperties.personalContextHistoryDirectory(userId);
        String filename = HISTORY_TIME.format(Instant.now()) + "-" + current.revision() + ".md";
        writeAtomically(directory.resolve(filename), current.content());
        try (Stream<Path> stream = Files.list(directory)) {
            List<Path> histories = stream.filter(Files::isRegularFile)
                    .sorted(Comparator.comparing(Path::getFileName).reversed()).toList();
            for (Path stale : histories.stream().skip(MAX_HISTORY_FILES).toList()) {
                Files.deleteIfExists(stale);
            }
        } catch (IOException exception) {
            log.warn("清理画像历史失败：directory={}", directory, exception);
        }
    }

    private void deleteProposal(String userId) {
        try {
            Files.deleteIfExists(storageProperties.personalContextPendingProposalFile(userId));
        } catch (IOException exception) {
            throw new IllegalStateException("删除画像提案失败", exception);
        }
    }

    private void writeAtomically(Path target, String content) {
        try {
            Path parent = target.getParent();
            if (Files.isSymbolicLink(parent)) throw new IllegalStateException("画像维护目录不能是符号链接");
            Files.createDirectories(parent);
            if (Files.isSymbolicLink(target)) throw new IllegalStateException("画像维护文件不能是符号链接");
            Path temporary = Files.createTempFile(parent, ".profile-maintenance-", ".tmp");
            try {
                Files.writeString(temporary, content, StandardCharsets.UTF_8);
                try {
                    Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE,
                            StandardCopyOption.REPLACE_EXISTING);
                } catch (AtomicMoveNotSupportedException exception) {
                    Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING);
                }
            } finally {
                Files.deleteIfExists(temporary);
            }
        } catch (IOException exception) {
            throw new IllegalStateException("保存画像维护数据失败", exception);
        }
    }

    private String truncate(String content, int tokenBudget) {
        if (content == null || content.isBlank() || tokenBudget <= 0) return "";
        if (tokenCounter.count(content) <= tokenBudget) return content.strip();
        int low = 0;
        int high = content.codePointCount(0, content.length());
        while (low < high) {
            int middle = (low + high + 1) / 2;
            String candidate = content.substring(0, content.offsetByCodePoints(0, middle));
            if (tokenCounter.count(candidate) <= tokenBudget) low = middle;
            else high = middle - 1;
        }
        return content.substring(0, content.offsetByCodePoints(0, low)).stripTrailing();
    }

    private String shortHash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest, 0, 12);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("当前运行环境缺少 SHA-256", exception);
        }
    }

    private Object lockFor(String userId) {
        storageProperties.userWorkspaceDirectory(userId);
        return userLocks.computeIfAbsent(userId, ignored -> new Object());
    }

    private record EvidenceBundle(
            List<ProfileGenerationRequest.MemoryEvidence> evidence,
            String fingerprint
    ) {
    }

    private record MaintenanceState(
            String lastCheckedMemoryFingerprint,
            Instant lastCheckedAt,
            String lastResult
    ) {
        private MaintenanceState {
            lastCheckedMemoryFingerprint = lastCheckedMemoryFingerprint == null
                    ? "" : lastCheckedMemoryFingerprint;
            lastResult = lastResult == null ? "never_checked" : lastResult;
        }

        private static MaintenanceState empty() {
            return new MaintenanceState("", null, "never_checked");
        }
    }
}
