# 本地项目导入、信任与初始化机制调研

> 调研日期：2026-09-13
>
> 范围：Claude Code、OpenAI Codex CLI/App、VS Code、Continue、Aider
>
> 来源策略：只使用官方文档、官方源码仓库和一手产品说明。GitHub 源码链接固定到调研时的 commit；文中的“建议”是结合 ButvanAgent 的分析，不是上游产品承诺。

## 1. 结论摘要

“导入项目”不应被实现成一次重型扫描，也不应等同于复制代码或创建 Git 仓库。更稳妥的产品模型是：**登记一个本地目录引用 → 建立明确的信任状态和能力边界 → 把会话稳定绑定到规范化后的项目身份 → 在后台渐进探测项目能力**。

建议 ButvanAgent 首版采用以下原则：

1. **目录是资源，项目是注册记录。** 导入只登记路径和元数据，不复制、不改写、不自动初始化 Git；空目录可以作为新项目。
2. **路径身份必须先规范化。** 项目去重、信任、会话归组、权限根和最近访问都必须使用同一个 `canonicalRootPath`，原始显示路径另存。Windows 需统一盘符大小写、分隔符、UNC/扩展路径等价形式。
3. **信任与导入分离。** “已登记”不自动等于“允许执行代码”。未信任项目仍可查看摘要和文件，执行命令、项目 hooks/MCP、项目级自动放行规则保持禁用或逐次询问。
4. **信任不能替代沙箱。** 即使用户信任项目，默认写权限也只覆盖项目根，网络和越界写入仍需审批；符号链接同时校验链接路径和真实目标。
5. **会话持久绑定项目 ID。** `projectId` 是业务外键，`cwd` 是运行快照；不能只靠路径字符串临时推断归组。项目路径失效时保留项目和会话，显示“目录不可用/重新定位”，不能让记录像数据丢失一样消失。
6. **初始化应异步、可取消、可重试。** 导入接口只做廉价校验和登记；Git、语言、构建命令、规则文件等探测随后进行。代码索引不是 MVP 前置条件，需要时再采用内容寻址的增量索引。
7. **删除默认只解除登记。** 明确写出“不删除磁盘文件、不删除历史会话”；物理删除目录应是另一条高风险能力。

## 2. 上游产品事实

### 2.1 Claude Code：工作目录、代码库信任与渐进初始化

- Claude Code 的基本入口是“进入项目目录后启动”。启动目录及其子目录构成项目访问范围，同时会读取 Git 状态和项目级 `CLAUDE.md`。[How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works#what-claude-can-access)
- 默认安全边界是：可写范围限制在启动目录及子目录，越过该范围要显式授权；敏感操作由权限规则和 OS 级 Bash 沙箱共同约束。[Security](https://code.claude.com/docs/en/security#built-in-protections)、[Permissions 与 sandbox 的关系](https://code.claude.com/docs/en/permissions#how-permissions-interact-with-sandboxing)
- 首次进入代码库会做信任确认。项目 `.claude/settings.json` 中会扩大能力的 `permissions.allow` 和 `additionalDirectories` 只有在用户信任目录后才生效；`deny`、`ask` 因为只收紧能力，可以立即生效。信任提示还会列出目录将启用的能力，供用户确认。[Project allow rules and workspace trust](https://code.claude.com/docs/en/permissions#project-allow-rules-and-workspace-trust)
- 信任身份在 Git 仓库中以仓库根为键；仓库外以启动目录为键；嵌套 Git 仓库不继承外层仓库信任。直接从用户主目录启动时，信任只在当前会话有效，不落盘。[Project allow rules and workspace trust](https://code.claude.com/docs/en/permissions#project-allow-rules-and-workspace-trust)、[Security additional safeguards](https://code.claude.com/docs/en/security#additional-safeguards)
- 符号链接不是简单按文本路径判断：allow 规则要求链接路径与真实目标都匹配；deny 规则任一路径匹配即阻止。[Read and Edit permissions](https://code.claude.com/docs/en/permissions#read-and-edit)
- 会话数据在本机按项目保存，可恢复和 fork；这说明“会话历史”与“当前进程”应解耦持久化。[Work with sessions](https://code.claude.com/docs/en/how-claude-code-works#work-with-sessions)
- 初始化项目不是强制导入步骤。用户可在首个会话中运行 `/init`：Claude 分析代码库后生成起始 `CLAUDE.md`；已有文件时建议改进而非覆盖。新的交互式流程先探测、补问并展示可审阅提案，再写文件。[How Claude remembers your project](https://code.claude.com/docs/en/memory#set-up-a-project-claudemd)、[Commands](https://code.claude.com/docs/en/commands)
- Claude Code 支持 `--add-dir` 扩展工作目录，但官方明确说它授予文件访问，不会完整发现附加目录中的项目配置，说明“主项目根”和“附加可访问根”应是不同概念。[CLI reference](https://code.claude.com/docs/en/cli-usage#cli-flags)

**可借鉴点：** 导入与信任拆开；能力扩张在确认前失败关闭；信任键优先使用 Git 根；初始化规则文件必须是后置、可审阅写入，而非导入时静默污染仓库。

### 2.2 OpenAI Codex CLI/App：工作根、会话 cwd、路径规范化与沙箱

- Codex CLI 将 `-C/--cd` 明确定义为 Agent 的工作根，并把 `--add-dir` 定义为主 workspace 之外的附加可写目录；还把“在新托管 Git worktree 中运行”作为独立选项。这三个概念没有混成一个路径列表。[Codex CLI shared options](https://github.com/openai/codex/blob/e61f3819007ad283b79417b85f44ab19cf1dd781/codex-rs/utils/cli/src/shared_options.rs#L66-L76)
- Codex 的持久线程元数据保存有效 `cwd`，并另外保存 runtime workspace roots；没有文件系统上下文的线程允许 `cwd = None`。这是一种“会话运行位置是持久契约”的设计。[Thread persistence metadata](https://github.com/openai/codex/blob/e61f3819007ad283b79417b85f44ab19cf1dd781/codex-rs/thread-store/src/types.rs#L55-L66)、[runtime workspace roots](https://github.com/openai/codex/blob/e61f3819007ad283b79417b85f44ab19cf1dd781/codex-rs/thread-store/src/types.rs#L108-L110)
- 项目信任查找会同时尝试解析后的 cwd 与 Git 仓库根。路径键先做规范化和 canonicalization；Windows 还会尝试去除 UNC 形式并统一为小写，避免同一目录因不同拼写产生多条信任记录。[Active project lookup](https://github.com/openai/codex/blob/e61f3819007ad283b79417b85f44ab19cf1dd781/codex-rs/config/src/config_toml.rs#L831-L885)
- 在有项目级信任决定、用户未显式覆盖 sandbox 时，Codex 通常选择 `workspace-write`；无可用 Windows sandbox 时降级为只读。`workspace-write` 与网络策略、附加 writable roots 组合为权限配置，而不是用一个“trusted=true”直接关闭所有限制。[Permission profile derivation](https://github.com/openai/codex/blob/e61f3819007ad283b79417b85f44ab19cf1dd781/codex-rs/config/src/config_toml.rs#L750-L827)
- Codex App 官方说明默认只允许 Agent 编辑其工作的目录或分支，网络或其他提升权限的命令仍要请求许可；App 与 CLI 使用同类可配置系统级沙箱。[Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/#secure-by-default-configurable-by-design)

**可借鉴点：** 把 `primaryRoot`、`additionalRoots`、`worktreeRoot` 分开建模；线程保存创建/恢复时的有效 cwd；项目查找共用跨平台规范化算法；“信任”决定默认策略，但不绕过 OS 级隔离。

### 2.3 VS Code：项目即 Workspace，未信任时降级而非拒绝打开

- VS Code 将 workspace 定义为一个窗口打开的一个或多个目录；单目录打开后会自动恢复该 workspace 的打开文件和布局，多根 workspace 则由 `.code-workspace` 描述。[What is a VS Code workspace?](https://code.visualstudio.com/docs/editing/workspaces/workspaces)
- 新目录默认以 Restricted Mode 打开，而不是完全拒绝用户查看；文本浏览与编辑仍可用，但可能执行代码的任务、调试、扩展能力被限制。[Workspace Trust](https://code.visualstudio.com/docs/editing/workspaces/workspace-trust)
- 信任目录会进入可管理的 Trusted Folders & Workspaces 列表；父目录信任可向子目录继承。加入一个未信任目录到已信任多根 workspace 时，用户必须确认，否则整个 workspace 降为 Restricted Mode。[Workspace Trust — Selecting folders](https://code.visualstudio.com/docs/editing/workspaces/workspace-trust#selecting-folders)、[Opening untrusted folders](https://code.visualstudio.com/docs/editing/workspaces/workspace-trust#opening-untrusted-folders)
- VS Code Agent 的内置文件工具被限制在当前 workspace；MCP 工具批准可以是 session、workspace 或 user 作用域。未信任 workspace 会禁用 Agent。[VS Code Copilot security](https://github.com/microsoft/vscode-docs/blob/main/docs/copilot/security.md#trust-boundaries)
- VS Code 的 Workspace Trust 核心接口将“当前 workspace 是否可信”“可信 URI 列表”“请求资源信任”“信任状态变更事件”拆成明确 API，值得作为 ButvanAgent 领域接口的参考。[Workspace Trust API](https://github.com/microsoft/vscode/blob/8e35945bae3f2b0b3d0276963281180f1ce10cb0/src/vs/platform/workspace/common/workspaceTrust.ts#L31-L106)

**可借鉴点：** 未信任并不等于不可导入；UI 要持续显示受限状态并允许撤销信任；最近项目应恢复用户工作状态；多根支持若未来引入，任一新增根都要重新计算整体边界。

### 2.4 Continue：索引是可恢复后台派生数据

- Continue 的代码库索引使用内容寻址和 tag 避免重复计算；切换分支时只重建新修改且未缓存的文件。[Continue indexing design](https://github.com/continuedev/continue/blob/5522c6f44ca0ac3528b37244818fbfa39b5af470/core/indexing/README.md#L1-L17)
- 索引目录册保存在 SQLite，先用修改时间计算 add/remove，再以内容 hash 复用跨分支 artifact；处理过程中逐步记录完成度，进程中断不会把未完成任务误记成成功。[Continue indexing pipeline](https://github.com/continuedev/continue/blob/5522c6f44ca0ac3528b37244818fbfa39b5af470/core/indexing/README.md#L11-L17)
- artifact 被拆为符号片段、全文检索、结构化 chunk、向量等不同索引，而不是一个不可分割的“大索引”。[Existing CodebaseIndex implementations](https://github.com/continuedev/continue/blob/5522c6f44ca0ac3528b37244818fbfa39b5af470/core/indexing/README.md#L19-L26)
- Continue 官方文档支持用 `.continueignore`（gitignore 语法）排除索引内容。[Codebase context and `.continueignore`](https://docs.continue.dev/reference/deprecated-codebase#how-to-ignore-files-during-indexing)

**可借鉴点：** 首版不要让索引阻塞项目出现；后续若需要索引，应把它视为可删除重建的读模型，按 `projectId + revision/branch + artifactType` 分区，并提供进度、取消、重试和 ignore 规则。

### 2.5 Aider：Git 优先，但不给非 Git 目录制造隐式副作用

- Aider 以当前本地 Git 仓库为核心工作范围；在非 Git 目录启动时会询问是否创建仓库，而不是未经同意初始化。它也允许通过 `--no-git` 完全关闭 Git 集成。[Git integration](https://aider.chat/docs/git.html)
- Aider 的自动提交与 dirty-file 保护是其可撤销策略的一部分；用户也可以关闭自动提交或 dirty commits。[Git integration](https://aider.chat/docs/git.html#disabling-git-integration)
- 对大型仓库，Aider 不把所有文件全文塞入上下文，而是生成有 Token 预算的 repo map，并按依赖图重要性与当前对话相关性选择片段。[Repository map](https://aider.chat/docs/repomap.html)
- Aider 支持 `.aiderignore` 与 `--subtree-only` 缩小大型 mono-repo 的范围；当前一次只工作于一个 Git 仓库。[Aider FAQ](https://aider.chat/docs/faq.html#can-i-use-aider-in-a-large-mono-repo)、[multiple repos](https://aider.chat/docs/faq.html#can-i-use-aider-with-multiple-git-repos-at-once)

**可借鉴点：** Git 是增强能力而非“项目”成立的先决条件；检测到非 Git/空目录时，可提供“初始化 Git”建议但必须单独确认；大型项目先提供轻量结构地图，精确文件仍按需读取。

## 3. 对比矩阵

| 维度 | Claude Code | Codex CLI/App | VS Code | Continue | Aider |
| --- | --- | --- | --- | --- | --- |
| 主身份 | 启动目录；Git 内提升到 repo root 作为信任键 | cwd + repo root 的规范化项目查找 | 单目录或多根 workspace | IDE workspace/repo + branch tag | 单一 Git repo；可无 Git |
| 未信任体验 | 首次交互确认，扩权配置延后生效 | 信任参与默认 sandbox 策略 | Restricted Mode，仍可浏览编辑 | 继承 IDE 边界 | 主要依赖命令审批/Git 撤销 |
| 写入边界 | 启动目录及子目录，越界需许可 | workspace-write + additional roots | workspace-limited | IDE workspace | Git 工作树/显式文件集 |
| 初始化 | `/init` 后置生成、已有文件不覆盖 | 项目规则与运行环境独立配置 | 打开即 workspace，配置可后置 | 后台增量索引 | 非 Git 时询问是否 init |
| 会话/状态 | 本地按项目持久化、可恢复 | thread 持久化 cwd 和 roots | 恢复 workspace UI 状态 | 索引目录册可增量恢复 | chat + Git 历史 |
| 大仓策略 | 分层规则与按需文件访问 | 工作根 + 工具按需读取 | Workspace API/排除设置 | 内容寻址分 artifact 索引 | 有预算 repo map、ignore/subtree |

## 4. ButvanAgent 当前缺口

当前代码已经有 UI 骨架，但后端领域契约和运行边界尚未接通：

- 侧栏已有“项目”分组、导入弹窗、按 `projectId` 过滤会话的展示占位；导入仍要求用户手输绝对路径，而不是桌面目录选择器。[Sidebar.tsx](../../agent-frontend/src/components/layout/Sidebar.tsx#L485-L580)、[导入弹窗](../../agent-frontend/src/components/layout/Sidebar.tsx#L648-L688)
- 后端显式拒绝 `SessionKind.PROJECT`，说明项目目录册必须先成为会话创建的依赖。[SessionCatalogService.java](../../agent-backend/server-agents/src/main/java/butvan/agent/agents/session/SessionCatalogService.java#L47-L61)
- `AgentFactory` 目前复用一个按模型缓存的全局 Agent，权限根固定为进程 cwd，workspace 固定为应用 workspace；这与“每个项目会话有自己的权限根/cwd”冲突。[AgentFactory.java](../../agent-backend/server-agents/src/main/java/butvan/agent/agents/agent/AgentFactory.java#L46-L74)、[Agent 构建](../../agent-backend/server-agents/src/main/java/butvan/agent/agents/agent/AgentFactory.java#L77-L108)
- `LocalConfigService` 已能透传未知顶层节点，短期可容纳 `projects`，但项目、信任、最近访问和索引状态继续增长后，单一 JSON 会产生并发更新和查询边界问题。[LocalConfigService.java](../../agent-backend/server-agents/src/main/java/butvan/agent/agents/config/LocalConfigService.java#L139-L165)

这里最关键的架构问题不是目录选择器，而是 **Agent 生命周期目前只按模型缓存**。若直接把项目路径塞进现有单例 Agent，会造成会话间 workspace/权限串用。项目导入落地前，应先把运行时 key 至少扩为 `model identity + project/root identity + permission profile`，或让每次 run 显式携带不可变的 `WorkspaceContext`。

## 5. 建议领域模型

### 5.1 Project 与路径身份

```text
Project
├── id: UUID                         # 稳定业务主键
├── displayName: string
├── selectedPath: string             # 用户当时选择的显示路径
├── canonicalRootPath: string         # 所有安全判断和去重的唯一键
├── filesystemIdentity?: string       # 可选：卷/文件标识，用于移动检测
├── trustState: UNTRUSTED | TRUSTED | REVOKED
├── availability: AVAILABLE | MISSING | INACCESSIBLE
├── git: NONE | REPOSITORY | WORKTREE
├── gitCommonRoot?: string
├── createdAt / lastOpenedAt
└── revision: long
```

不要使用 `displayName` 或未经规范化的路径作为外键。建议由 Tauri 或后端中**唯一一个 PathIdentityService**执行：绝对化、`toRealPath`/canonicalize、目录类型检查、平台大小写规则、Windows UNC/长路径归一、拒绝过宽根目录。符号链接可被选择，但每次能力校验同时验证 canonical target，不能只在导入时检查一次。

### 5.2 ProjectTrust 与 Capability

信任不应只有一个隐含布尔值，至少要记录：

```text
ProjectTrustDecision
├── projectId
├── canonicalRootAtDecision
├── state
├── decidedAt
├── source: USER_DIALOG | MANAGED_POLICY
└── capabilitySummaryHash
```

`capabilitySummaryHash` 用于在项目新增会扩权的 hooks、MCP、附加目录或执行配置后提醒用户复核。初版可以不支持项目 hooks，但数据模型不要把“信任”写死成“永久允许所有工具”。

建议默认权限：

| 状态 | 浏览/搜索 | 修改项目内文件 | 执行命令 | 网络 | 项目级 hooks/MCP/自动 allow |
| --- | --- | --- | --- | --- | --- |
| 未信任 | 允许或只读 | 逐次确认/禁止 | 逐次确认或禁止 | 禁止/逐次确认 | 禁止 |
| 已信任 | 允许 | 项目根内按会话模式 | 沙箱内按规则，越界确认 | 默认受限 | 单独审阅后启用 |
| 路径失效 | 禁止运行 | 禁止 | 禁止 | 禁止 | 禁止 |

### 5.3 ProjectSessionBinding

会话创建时持久化：

```text
Session
├── projectId?: UUID
├── workspaceRootSnapshot?: string
├── permissionProfileId
└── kind: GENERAL | PROJECT
```

恢复会话时先由 `projectId` 解析当前项目，再比较 `workspaceRootSnapshot`：

- 路径相同：正常恢复；
- 项目被用户重新定位：显示变更并用新根启动，保留审计；
- 目录缺失/不可访问：会话仍可查看，但禁止工具运行，提供“重新定位项目”；
- 项目解除登记：历史会话保留为 detached，不能被静默删除或从全局搜索消失。

## 6. 推荐交互流程

### 6.1 导入

1. 用户点击“导入项目”。
2. Tauri 原生目录选择器返回路径；前端不要求手填路径，但可保留“粘贴路径”作为辅助入口。
3. 后端执行廉价预检：存在、目录、可读、canonicalize、危险根拒绝、重复检测。
4. UI 展示确认页：名称、规范化路径、Git/空目录状态、发现的项目级能力摘要，以及“导入不会复制或删除文件”。
5. 用户选择：
   - **导入并以受限模式打开**；
   - **信任并导入**（解释项目内命令执行风险）。
6. 登记成功后项目立即出现在侧栏，并更新 `lastOpenedAt`。
7. 后台执行可取消的 `ProjectProbeJob`，探测 Git、语言、构建文件、规则文件和规模；结果是派生元数据，不影响项目可用。
8. 空目录只显示“空项目”，可在后续独立操作中创建模板或初始化 Git。

### 6.2 打开与最近项目

- 最近项目按 `lastOpenedAt` 排序；排序字段只在用户打开项目或创建项目会话时更新，后台扫描不能制造“最近活动”。
- 项目侧栏与会话全局搜索都从持久化目录册查询，不依赖内存列表或最近 N 条窗口。
- 列表启动时只做 `exists/isDirectory/readable` 快检；重扫描在后台发生。
- 项目项持续显示状态：受限、可信、目录缺失、探测中、探测失败。

### 6.3 移除与重新定位

- “从 ButvanAgent 移除”只删除项目注册与可重建索引，不触碰磁盘目录。
- 若项目仍有会话，确认框说明会话将转为 detached，但历史仍保留。
- “重新定位”要求用户重新选择目录，并用 Git remote、`.git` identity、关键文件指纹等给出相似度提示；最终仍由用户确认，不能自动把旧信任迁移到不确定的新目录。

## 7. 分阶段实施建议

### Phase 0：先建立不变量

- 定义 `ProjectRegistry`、`PathIdentityService`、`ProjectTrustService`、`WorkspaceContext`。
- 明确一个 run 只有一个 primary root；所有文件、命令、搜索工具从同一个 `WorkspaceContext` 取边界。
- 修正 Agent 按模型全局缓存的问题，防止跨项目权限串用。

### Phase 1：可用 MVP

- Tauri 目录选择器。
- 项目 import/list/get/remove/relocate API。
- `PROJECT` 会话创建、列表、恢复与 `projectId` 持久化。
- 规范化路径去重、危险根拒绝、目录失效状态。
- 项目根内 workspace-write，网络/越界审批。
- 移除只解除登记；空目录支持。

### Phase 2：信任与项目理解

- 受限/可信状态切换与可撤销信任。
- Git、语言、构建文件、规则文件异步探测。
- 导入确认页展示可能扩权的项目配置。
- 轻量 project manifest/repo map；忽略 `.gitignore` 与产品 ignore 规则。

### Phase 3：规模化能力

- 内容寻址的可恢复增量索引，artifact 分区和进度 UI。
- 项目移动识别、索引重建、目录变更监控。
- 评估多根 workspace；在此之前宁可使用“附加只读/可写根”显式授权，也不要把多个项目隐式合并为一个权限边界。

## 8. 验收重点与高风险测试

1. 同一路径的 `.`、`..`、符号链接、大小写、尾部分隔符、Windows `C:\\`/`c:/`/UNC/`\\?\` 形式只能得到一个项目身份。
2. 链接位于项目内但目标在项目外时，不得借此越界读写。
3. 两个项目会话并发运行时，A 项目 Agent 不能读写 B 项目；切换模型也不能改变该边界。
4. 解除信任后，正在运行与下次恢复的会话都立即采用收紧后的权限。
5. 目录删除、卸载磁盘、权限变化后，项目和会话仍可发现，工具执行失败要有明确状态而非“找不到会话”。
6. 导入一百万文件的仓库时，登记接口仍快速返回；探测/索引可取消且重启后可恢复或安全重建。
7. 项目内含恶意 `.claude/settings.json`、MCP 配置、hooks、构建脚本时，未信任阶段不得自动执行。
8. 空目录、非 Git 目录和 dirty Git 仓库均可导入；不得静默 `git init`、提交或改 `.gitignore`。
9. 移除项目不得删除任何用户文件；重新导入可重新关联旧会话，但不能无提示继承已撤销信任。
10. 最近项目排序、项目内会话归组和全局搜索全部基于持久化真源，不受内存分页或路径显示格式影响。

## 9. 最终建议

现有《ButvanAgent 项目导入方案》的“目录引用、不复制、项目目录作为权限根、删除只解除注册”方向是正确的。根据本次上游调研，建议在正式实施前补强三项：

1. 将 **路径规范化与稳定项目身份**提升为独立基础能力，所有层只认同一个 canonical key；
2. 在“导入”与“可执行信任”之间增加明确状态机，默认受限，信任后仍保留沙箱；
3. 先解决 **Agent/Permission/Workspace 的会话级隔离**，再接 UI，否则功能表面可用但存在跨项目越权风险。

索引、自动生成项目说明、多根 workspace 都应放到后续阶段。MVP 的成功标准不是“导入后立刻理解整个仓库”，而是“目录登记可靠、会话归属不丢、权限不串、路径失效可恢复”。
