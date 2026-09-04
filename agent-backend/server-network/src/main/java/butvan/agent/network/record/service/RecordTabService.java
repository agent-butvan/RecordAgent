package butvan.agent.network.record.service;

import butvan.agent.network.record.model.RecordModels.RecordTab;
import butvan.agent.network.record.model.RecordModels.RecordType;
import butvan.agent.network.record.repository.RecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** 管理系统与自定义分类 Tab，并隐藏默认分类初始化细节。 */
@Service
@RequiredArgsConstructor
public class RecordTabService {
    private static final List<TabSeed> SYSTEM_TABS = List.of(
            new TabSeed("八股文", "knowledge", 10), new TabSeed("面试题", "interview", 20),
            new TabSeed("每周复盘", "weekly_review", 30), new TabSeed("每日手记", "journal", 40),
            new TabSeed("读书心得", "reading", 50), new TabSeed("随记", "quick", 60));
    private final RecordRepository repository;

    /** 首次访问时幂等建立系统 Tab。 */
    @Transactional
    public List<RecordTab> list(String ownerId) {
        Instant now = Instant.now();
        for (TabSeed seed : SYSTEM_TABS) repository.insertTab(UUID.randomUUID().toString(), ownerId, seed.name(), seed.key(), seed.order(), now);
        return repository.findTabs(ownerId);
    }

    /** 新建一个用户自定义 Tab。 */
    public RecordTab create(String ownerId, String rawName) {
        String name = rawName == null ? "" : rawName.trim();
        if (name.isEmpty()) throw new IllegalArgumentException("Tab 名称不能为空");
        if (name.length() > 20) throw new IllegalArgumentException("Tab 名称不能超过 20 个字符");
        if (repository.findTabs(ownerId).stream().anyMatch(tab -> tab.name().equalsIgnoreCase(name))) {
            throw new IllegalArgumentException("已经存在同名 Tab");
        }
        RecordTab tab = new RecordTab(UUID.randomUUID().toString(), name, null, 1000 + repository.findTabs(ownerId).size());
        repository.insertTab(tab.id(), ownerId, tab.name(), null, tab.sortOrder(), Instant.now());
        return tab;
    }

    /** 仅允许删除自定义 Tab，其中记录回到“全部”视图。 */
    public void delete(String ownerId, String tabId) {
        if (!repository.deleteCustomTab(ownerId, tabId)) throw new IllegalArgumentException("系统 Tab 不可删除或 Tab 不存在");
    }

    /** 校验显式 Tab，未提供时根据记录类型选择系统默认 Tab。 */
    public String resolve(String ownerId, String requestedTabId, RecordType type) {
        List<RecordTab> tabs = list(ownerId);
        if (requestedTabId != null && !requestedTabId.isBlank()) {
            return tabs.stream().filter(tab -> tab.id().equals(requestedTabId)).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("记录分类不存在")).id();
        }
        String key = switch (type) {
            case WEEKLY_REVIEW -> "weekly_review";
            case JOURNAL -> "journal";
            case READING -> "reading";
            case QUICK -> "quick";
            case LEARNING -> "knowledge";
        };
        return tabs.stream().filter(tab -> key.equals(tab.systemKey())).findFirst().orElseThrow().id();
    }

    private record TabSeed(String name, String key, int order) { }
}
