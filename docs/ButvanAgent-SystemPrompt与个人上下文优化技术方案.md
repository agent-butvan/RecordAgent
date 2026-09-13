# ButvanAgent System Prompt 与个人上下文优化技术方案

> 状态：Phase 1～3 核心链路与用户控制已实现；低频画像自动维护、revision 缓存与 40 条质量回归集待后续补齐
> 日期：2026-09-13

## 1. 结论

推荐保留 `disableWorkspaceContext()`，不要直接恢复 AgentScope 默认的整包 Workspace Context，也不要只把 `maxContextTokens` 调小。改为实现一套“静态 System Core + 小型用户画像 + 按需记忆召回 + 路径级项目规则”的混合上下文机制：

1. System Prompt 只保留身份、安全、权限、工具和输出等不可缺少的运行规则，目标从当前约 1,977 个本地估算 Token 压缩到 900～1,200。
2. 从长期记忆中独立维护 250～350 Token 的 `User Profile Snapshot`，每轮都带上，恢复 Agent 对用户长期偏好、称呼和工作方式的基本了解。
3. 每轮在本地对 `MEMORY.md + memory/*.md` 做一次零模型调用的有界检索；只有相关度达标才注入 0～600 Token 的 episodic memory。
4. 项目 `AGENTS.md` 与 Knowledge 不进入普通对话；代码任务继续按目标路径加载适用规则，领域资料只在明确需要时读取。
5. 所有上下文块必须独立计数、带来源、设硬上限；个人资料和记忆作为参考数据注入，不获得 System Prompt 的指令优先级。

这不是在“完整上下文”和“完全失上下文”之间折中，而是把不同性质的信息拆到正确的生命周期与优先级中。

## 2. 当前问题诊断

### 2.1 真实成本

本机 Token 用量读模型中的历史聊天调用显示，启用默认 Workspace Context 时的 `system_prompt_tokens` 常见值为 7,345～8,456；当前用户命名空间中的 `MEMORY.md` 约 19.6K 字符，按项目 `approximate-v1` 计数约 5,034 Token。关闭 Workspace Context 后，当前代码生成的基础 System Prompt 约为 1,977 Token。

这说明主要浪费不是 AgentScope 状态存储或记忆写入本身，而是把整份长期记忆重复拼入每一次模型调用。最新的 Tool Schema 按需加载已经解决另一个大头，但它不会恢复用户记忆。

### 2.2 `disableWorkspaceContext()` 关闭的是召回入口，不是记忆系统

当前 `AgentFactory` 仍保留 AgentScope 的 `MemoryFlushMiddleware`、`MemoryMaintenanceMiddleware`、`memory_search`、`memory_get` 和 `memory_save`；`disableWorkspaceContext()` 只是不再自动把 Workspace Context 追加到 System Prompt。因此长期记忆仍在持续写入，只是主 Agent 不再自动看到它。

与此同时，工具 Schema 路由默认只暴露 `reset_equipped_tools`。一次历史记忆查询通常需要：

1. 主模型决定启用 `memory` 工具组；
2. 下一次模型调用执行 `memory_search`；
3. 再下一次模型调用执行 `memory_get`。

普通交流中的隐式个性化很难稳定触发这条三阶段链路，所以用户会直观感觉 Agent “不再了解我”。

### 2.3 直接恢复默认 Workspace Context 仍有结构性问题

AgentScope Java 2.0.0 的 `WorkspaceContextMiddleware` 同时拼接运行环境、`AGENTS.md`、`MEMORY.md`、Knowledge 摘要与完整文件清单，默认预算为 8,000 Token，但其估算方式是 `text.length() / 4`。项目自己的 `approximate-v1` 对非 ASCII 字符按一个字符约一个 Token 计算；中文场景中两者可能相差约四倍。

此外，默认中间件只根据剩余预算截断 `MEMORY.md`，固定部分（规则、Knowledge、环境说明）超过预算时没有总量硬截断。因此简单调用 `.maxContextTokens(1000)` 既不能得到可靠的中文 Token 上限，也没有解决信息类型、权限和生命周期混在一起的问题。

### 2.4 当前记忆检索能力不足以承担自动召回

AgentScope 2.0.0 的 `memory_search` 对整段查询做不区分大小写的精确子串匹配，并返回全部命中行；它没有分词、相关度排序、Top-K 或返回 Token 上限。用户自然语言与历史表述稍有不同就可能零命中，命中较多时结果又可能无界膨胀。

## 3. 开源项目可迁移的做法

详细证据与固定源码链接见配套调研文档 [`System-Prompt与上下文管理开源项目调研.md`](research/System-Prompt与上下文管理开源项目调研.md)。本方案采用以下共同模式：

- Aider 的 repo map 不是发送完整仓库，而是按相关度排序并压进可配置 Token 预算，默认 `map-tokens` 为 1K；它还用实际模型 tokenizer 估算上下文大小。[官方说明](https://github.com/Aider-AI/aider/blob/main/aider/website/docs/repomap.md)与[实现](https://github.com/Aider-AI/aider/blob/main/aider/repomap.py)
- Continue 把规则分为始终应用、按 glob/regex 自动附加以及由 Agent 按描述选择，说明项目规则应基于确定性范围加载，而不是全部常驻。[规则文档](https://github.com/continuedev/continue/blob/main/docs/customize/deep-dives/rules.mdx)
- OpenAI Codex 按项目根目录到当前工作目录的层级发现 `AGENTS.md`，并明确要求所有上下文项有硬上限、避免频繁改动破坏缓存。[发现实现](https://github.com/openai/codex/blob/main/codex-rs/core/src/agents_md.rs)与[仓库上下文规范](https://github.com/openai/codex/blob/main/AGENTS.md)
- OpenHands 的 microagent 以 `always`、`keyword` 和 `manual` 三种触发方式加载附加知识，适合映射为 ButvanAgent 的“用户画像常驻、记忆相关触发、领域资料手动/显式触发”。[设计来源](https://github.com/OpenHands/OpenHands/issues/7547)

这些项目没有证明“把所有记忆放进 System Prompt”是必要条件；更稳定的共同点是：少量常驻信息、可解释触发、按相关度选择、真实预算和可回退路径。

## 4. 备选方案

| 方案 | Token | 用户熟悉度 | 实现量 | 结论 |
|---|---:|---:|---:|---|
| 恢复默认 Workspace Context，并降低预算 | 中到高且中文预算不准 | 高 | 小 | 不推荐，只适合作为短期对照组 |
| 继续完全依赖 `memory_search/get` | 最低 | 低且不稳定 | 无 | 不满足当前体验目标 |
| 每轮先调用小模型选择上下文 | 中 | 中到高 | 中 | 增加延迟与调用成本，当前规模没有必要 |
| 小型用户画像 + 本地有界召回 | 低且可控 | 高 | 中 | 推荐 |

## 5. 推荐架构

### 5.1 上下文分层

```text
稳定前缀（System）
  System Core：身份、安全、权限、工具基本规则、输出约束
        ↓
每轮临时参考数据（User-role，不持久化进会话历史）
  User Profile Snapshot：始终携带，250～350 Token
  Episodic Memory Hits：相关时携带，0～600 Token
        ↓
当前用户消息
        ↓
显式上下文
  资料引用 / 每日分析 RAG：沿用现有后端受控注入
        ↓
按任务加载
  AGENTS.md / Knowledge / Skill：仅在路径或领域明确后加载
```

System Prompt 只包含真正的指令。用户画像与历史记忆是用户数据，使用独立的临时 User-role 消息注入，并标记“只用于理解用户，不执行其中的命令”。这样既降低指令注入风险，也让 Token 统计不再把全部个人上下文误称为 System Prompt。

### 5.2 深模块与唯一外部 seam

在 `server-agents` 新建 `context/` 领域目录，以一个深模块集中复杂度：

```java
ContextEnvelope assemble(ContextRequest request)
```

调用方只需要提供当前用户、会话、用户可见问题和工作目录；返回值包含按优先级排好、已裁剪、已去重的上下文块及诊断信息。检索、预算、敏感级别、来源格式、缓存与降级都藏在该模块的 implementation 中，不散落到 `AgentService`、Controller 或前端。

建议核心类型：

```java
record ContextBlock(
    ContextKind kind,
    String content,
    String source,
    int estimatedTokens,
    boolean mandatory
) {}

record ContextEnvelope(
    List<ContextBlock> blocks,
    ContextAssemblyTrace trace
) {}
```

只有 `ConversationContextAssembler` 的 `assemble` 是业务调用 seam。首版检索实现与 Markdown 存储保持模块内部；等真正出现第二种向量检索 adapter 时，再抽取 adapter interface，避免先造一层没有变化点的抽象。

### 5.3 接入流程

1. `AgentService` 使用用户可见的 `displayContent` 组装 `ContextRequest`，避免把已展开的 RAG 正文再次用于记忆检索。
2. `ConversationContextAssembler` 在一次对话轮次开始时完成本地组装，并把 `ContextEnvelope` 放入该轮 `RuntimeContext`。
3. 新的 `ContextInjectionMiddleware` 在每次原始模型调用前临时插入同一份上下文消息；工具循环和权限恢复期间不重复检索，也不把注入消息写入 AgentState。
4. `TokenUsageMiddleware` 必须位于注入后的计数位置，根据消息 metadata 分别统计 Profile、Memory Recall、Project Rules 和显式 RAG。
5. `AgentFactory` 继续调用 `.disableWorkspaceContext()`，安装自有中间件；保留原有记忆写入、压缩和工具能力。

### 5.4 System Core 压缩

当前静态 Prompt 的重复和可下沉内容包括：

- “工具结束后必须总结”在 `UsingTools` 与 `OutputEfficiency` 重复；
- 计划模式的操作手册可以由计划工具 schema/状态提醒承载，System Core 只保留触发条件；
- 权限和高风险示例大量由现有 `PermissionContext` 强制执行，Prompt 只需解释行为原则；
- Markdown 表格的完整格式教程、专用工具逐项对照和冗长示例可缩为短规则；
- 模型名、Git 分支和日期不属于静态行为规则，应作为末尾短环境块按轮更新，避免 Agent 缓存导致分支/日期过期。

建议预算：

| 块 | 目标 Token | 超限处理 |
|---|---:|---|
| Identity + Safety | 150 | 不截断 |
| Runtime + Permission | 180 | 不截断 |
| Task + Tool policy | 450 | 不截断 |
| Context routing | 150 | 不截断 |
| Tone + Output | 150 | 不截断 |
| Environment | 100 | 删除低价值字段 |
| System Core 合计 | 900～1,200 | 构建测试硬失败 |

静态内容固定顺序，动态环境永远放在尾部，以保留供应商 Prompt Cache 可复用的最长前缀。缓存只降低费用或延迟，不替代上下文占位的实际 Token 验收。

## 6. 用户画像与长期记忆

### 6.1 三种数据职责

| 数据 | 内容 | 生命周期 | 注入策略 |
|---|---|---|---|
| User Profile | 称呼、语言、沟通方式、稳定偏好、长期目标 | 长期、低频变化 | 每轮 250～350 Token |
| Episodic Memory | 历史决定、事件、日期、人物、阶段性上下文 | 长期、持续增长 | 相关时 Top-K，最多 600 Token |
| Session Working Set | 当前任务目标、进度、最近工具结果 | 当前会话 | 由现有历史和 compaction 管理 |

必须把“助手身份”“项目工程规范”“用户画像”分开。现有 `MEMORY.md` 混有不同主体的信息，不能直接截取前 N 个字符作为用户画像。

### 6.2 User Profile Snapshot

建议在当前用户命名空间保存 `profile/PROFILE.md`，采用固定小结构：

```markdown
# 用户画像
## 交互偏好
## 稳定技术偏好
## 长期关注事项
```

不进入常驻画像的内容包括：密钥、Token、完整财务/健康信息、临时任务、助手自身设定、完整项目规范和未经确认的第三方隐私。

首次上线时，从现有 `MEMORY.md` 生成一次候选画像，展示给用户确认后才启用；之后只在长期记忆 revision 变化时维护，不在每轮对话额外调用模型。首版可复用记忆 consolidation 的低频模型调用生成结构化画像；失败时保留上一 revision，不以空结果覆盖。

### 6.3 自动记忆召回

首版不引入向量数据库或外部 embedding：当前本机长期记忆总量仍小，使用内存索引即可。

- Markdown 按标题和独立 bullet 切成 150～300 Token 的 chunk，保留文件、行号、日期与内容 hash。
- 中文使用字 bigram/trigram，英文使用规范化单词；以 BM25-like 分数、时间衰减、主体类型和精确短语加权。
- 每轮都可以执行本地检索，但只有分数超过阈值才注入；最多 3 个 chunk、合计 600 Token。
- 文件 mtime/hash 未变化时复用索引；变化时只重建受影响文件。
- `memory_search` 工具也复用同一个检索 implementation，返回 Top-K 和硬 Token 上限；深度追溯再用 `memory_get`。
- 如果检索失败或索引损坏，降级为“仅 User Profile”，不能阻断主对话。

只有当记忆量或召回评测证明本地词法检索不足时，再增加本地 embedding adapter；不能为了“语义检索”默认把整份私密记忆发送给外部 embedding 服务。

## 7. 项目规则与 Knowledge

- 普通生活对话不注入任何项目 `AGENTS.md`。
- 用户明确提到文件路径时，按项目根到目标路径解析适用 `AGENTS.md`；尚无目标路径时，保留当前“先查找再读取”的轻量规则。
- 对修改操作，适用规则属于 mandatory context，不能为了满足预算而静默截断；若规则本身过大，应记录预算溢出并提示治理该规则文件。
- 当前根 `AGENTS.md` 按 `approximate-v1` 约 4,579 Token。后续若希望进一步降低代码任务成本，应单独把根文件压成项目级最小契约，将领域细节下沉到已有子级 `AGENTS.md`；这属于 DOX 治理任务，不与本次个人上下文改造混做。
- Knowledge 只提供文件目录/摘要检索，不注入完整正文；显式打开的内容使用现有 RAG 归因。

## 8. Token 预算与裁剪规则

默认预算建议：

| 场景 | System Core | Profile | Memory Recall | Managed Context 目标 |
|---|---:|---:|---:|---:|
| 普通对话 | ≤1,200 | ≤350 | 0 | ≤1,550 |
| 个性化/历史问题 | ≤1,200 | ≤350 | ≤600 | ≤2,150 |
| 代码任务 | ≤1,200 | ≤350 | 通常 0 | 另加适用项目规则 |

裁剪顺序为：低分记忆 → 较旧记忆 → Profile 中的低优先级长期关注 → 非必要环境字段。System Core、安全规则和已确定适用的项目规则不截断。所有预算使用项目统一 `TokenCounter`；能取得 provider tokenizer 时使用对应 adapter，不能取得时使用保守的 `approximate-v1`，不再出现另一套 `chars / 4`。

## 9. 配置、隐私与可观测性

建议新增配置但先保持内部默认值，待行为稳定后再开放完整 UI：

```text
context.mode = disabled | hybrid | legacy
context.systemCoreMaxTokens = 1200
context.profileMaxTokens = 350
context.memoryRecallMaxTokens = 600
context.memoryRecallTopK = 3
context.allowSensitiveRecall = false
```

- `hybrid` 为目标模式，`disabled` 是快速回滚，`legacy` 只用于 A/B，不作为生产默认。
- Token 用量页继续保留顶层 System / History / Tool Schema 等口径，同时增加 Context 明细：System Core、Profile、Memory Recall、Project Rules、显式 RAG。
- 每次组装记录候选数、命中数、丢弃原因、各块 Token、来源和 profile revision；日志只记录路径与数字，不记录个人正文。
- Profile 提供查看、编辑、暂停和清空入口；敏感信息默认不自动召回到云模型。

已实现的设置接口为：`GET /agent/personal-context` 查询状态，`PUT /agent/personal-context/profile` 保存画像，`PUT /agent/personal-context/enabled` 更新开关，`DELETE /agent/personal-context/profile` 清空画像。接口只作用于 `CurrentUserProvider` 解析出的当前本地用户，不接受调用方传入用户 ID。

## 10. 分阶段实施

### Phase 0：基线与计数统一

- 为每个 Prompt section 增加 Token 快照测试，记录当前基线。
- 抽出唯一 `TokenCounter` 给 Prompt、Context Budget 和用量归因共用。
- 加入中文、英文和混合文本的预算测试。
- 建立真实任务集与 legacy/disabled/hybrid 三组对照。

### Phase 1：System Core

- 合并 `PromptsSections` 重复规则，将静态 Prompt 压到 900～1,200 Token。
- 环境信息改为每轮生成的短尾部块。
- 保持 `.disableWorkspaceContext()`，不改变记忆写入和会话恢复。

### Phase 2：Context Assembler 与自动召回

- 新建 `context/` 深模块和 `ContextInjectionMiddleware`。
- 接入有界 Profile Snapshot 的存储、读取与注入；首次迁移先生成候选文件，未确认前不作为模型上下文。
- 实现有界 Markdown chunk 索引、相关度排序、来源与降级。
- 让自动注入和 `memory_search` 共用同一检索 implementation。
- 扩展 Token 归因，覆盖工具循环、权限暂停/恢复和 compaction 后继续对话。

### Phase 3：Profile 维护与用户控制

- 接入低频 profile 维护和 revision 缓存。
- 增加候选 Profile 的确认、编辑、暂停和清空，以及个人上下文开关和用量明细 UI。

当前已交付查看、编辑、暂停、清空、兼容来源提示与个人上下文总开关；Profile 与 Memory Recall 已在聊天轮次、SQLite 读模型和前端用量页中独立归因。低频自动维护和 revision 缓存未随本阶段启用，避免未经用户确认的模型调用自动改写画像，待质量回归集建立后再单独评审。

每个 Phase 独立提交、独立回滚，不一次性重写 AgentScope 会话或记忆持久化。

## 11. 验收标准

### Token 与性能

- `System Core <= 1,200` estimated tokens，构建测试硬限制。
- 普通对话 Managed Context p50 ≤ 1,550，个性化问题 p95 ≤ 2,150，不包含用户明确选择的大篇资料 RAG。
- 自动召回不产生额外模型调用，本地检索 p95 < 30 ms（以当前 Memory 规模测试）。
- 每个注入块都有硬上限；不得恢复整份 `MEMORY.md` 或 Knowledge 注入。

### 质量

- 建立至少 40 条回归样本：10 条普通交流、15 条用户偏好/历史决定、10 条代码规则、5 条无关或冲突记忆。
- Profile 中的稳定偏好命中率 ≥ 95%；有明确历史证据的问题 Recall@3 ≥ 85%。
- 与 legacy 全量上下文相比，个性化答案通过率下降不超过 5%；与 disabled 相比明显提升。
- 无关记忆注入率 < 10%；未授权敏感信息自动注入为 0。

### 稳定性

- 覆盖模型切换、应用重启、会话恢复、权限暂停恢复、Memory 文件为空/损坏/超长和索引重建。
- Profile 生成失败不覆盖旧版本，召回失败不阻断对话。
- Provider 实际 Usage 与本地估算继续分开，不互相补齐。

## 12. 风险与控制

| 风险 | 控制 |
|---|---|
| Profile 过时或写错主体 | 固定结构、来源 revision、用户确认、旧版本保留 |
| 自动召回无关记忆 | 分数阈值、Top-K、总预算、负样本评测 |
| 记忆中的文本被当作指令 | User-role 参考块、明确数据标记、来源隔离 |
| 中文 Token 再次失真 | 统一 `TokenCounter`、混合语言测试、Provider Usage 对照 |
| 项目规则因预算被截断 | mandatory 不截断，单独记录溢出并治理规则文件 |
| 新中间件污染会话历史 | 只在 `onModelCall` 构造临时消息，不写 AgentState/transcript |
| 增加维护复杂度 | 只暴露一个 assembler seam，检索与预算均留在模块 implementation 内 |

## 13. 待审核决策

建议本次审核确认以下四点：

1. 接受 `hybrid` 为目标模式，继续禁用 AgentScope 默认 Workspace Context。
2. 接受每轮常驻 250～350 Token 的用户画像，以换取稳定的“了解用户”体验。
3. 接受首版采用本地词法召回、敏感记忆默认不自动注入，不立即引入 embedding。
4. 完整目标包含 Phase 0～3，但按阶段独立实现和审核；根 `AGENTS.md` 精简作为另一项 DOX 治理任务，不混入本次改造。
