# ButvanAgent 项目导入方案

## 目标与范围

桌面端通过**目录选择器**导入本地项目根目录：可以是已有代码项目，也可以是**空目录**（用于全新项目开发）。导入后，项目会话中的 Agent 直接在该目录内读写文件、执行命令、搜索代码；项目的权限根即项目目录本身。

本期是本地方案：项目引用注册在独立目录册 `~/.butvan-agent/projects/catalog.json`，**不复制项目文件**、不提供跨设备同步。不实现远程仓库导入、云端项目目录册或多用户。

## 交互流程

1. 侧栏点击"导入项目"，弹出 Tauri 目录选择器；用户选择已有项目根目录或空目录。
2. 前端把目录路径交给后端导入接口；后端校验后注册，返回项目摘要。
3. 侧栏项目列表出现该项目；用户在项目内新建 `PROJECT` 类型会话。
4. 项目会话中，Agent 的 shell cwd 与业务文件根指向项目目录；AgentState、计划、记忆等应用运行态仍位于应用 workspace。
5. 删除项目：仅解除注册并清理该项目的后端运行态，**不删除用户目录**。

## 数据模型

独立项目目录册保存如下记录，避免项目生命周期与模型、账号等配置发生并发覆盖：

```json
"projects": [
  {
    "id": "3f2a9c1e-...",
    "name": "my-project",
    "rootPath": "/Users/butvan/Butvan_Projets/my_code/MyProject",
    "importedAt": "2026-08-30T10:00:00Z"
  }
]
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID | 后端生成，作为项目唯一标识与后续绑定键 |
| `name` | string | 用户可见名称，可默认取目录名 |
| `rootPath` | string | 导入时校验并规范化后的真实路径 |
| `importedAt` | ISO 时间 | 导入时间，用于排序与审计 |

## 后端模块与接口

新增 `server-agents` 的 `butvan.agent.agents.project` 包，核心是一个**深模块 `ProjectRegistry`**：对外只暴露 4 个方法，把路径校验、去重、持久化、解析全部藏在实现里。

```java
ProjectSummary importProject(String name, String rootPath); // 校验 + 去重 + 原子落盘
List<ProjectSummary> listProjects();
ProjectSummary get(String projectId);                       // 目录离线时仍可管理引用
ProjectSummary resolve(String projectId);                   // 仅返回当前可用项目
void remove(String projectId);                              // 只删注册，不删用户目录
```

`importProject` 校验规则：

- 目录必须存在且可读；**空目录允许**（支持全新项目开发）；
- 项目根用 `toRealPath()` 规范化，统一项目身份；文件树额外跳过符号链接；
- 拒绝 `/`、用户家目录、系统目录（`/System`、`/Library`、`/etc`、`/Applications` 等）作为项目根；
- 规范化后的真实路径与已有项目重复 → 拒绝导入；
- 后端不复制、不扫描、不索引项目内容。

`resolve` 供 `AgentFactory` / `AgentService` 查询权限根与 workspace，是后续接缝改造的唯一入口。

## 接缝改造（既有代码改动点）

1. **项目级 Agent（`AgentFactory`）**：缓存键扩展为模型实例 + 规范化项目根，项目会话不再复用 GENERAL 或其他项目的文件系统实例。
2. **文件系统（`AgentFactory`）**：使用 AgentScope `LocalFilesystemSpec(project + projectWritable + ROOTED)`；项目业务文件写入真实目录，shell cwd 为项目根，应用 workspace 继续保存 AgentState、计划、记忆等运行态。
3. **计划模式文件：不动**。`plans/PLAN.md` 继续由 AgentScope 写入应用 workspace，不污染项目目录。
4. **会话（`session` 包）**：`CreateSessionRequest` 增加可选 `projectId`；启用 `SessionKind.PROJECT`（当前仅为预留枚举）；`SessionSummaryDto` / `SessionDetailDto` 返回 `projectId`；GENERAL 创建不带 `projectId`。
5. **运行态不落项目目录**：AgentState、transcripts 继续按 sessionId 隔离在 `~/.butvan-agent` 下，项目目录内只出现 Agent 主动写入的业务文件。

## API 契约

| 方法 | 地址 | 请求 | 成功响应 | 错误语义 |
| --- | --- | --- | --- | --- |
| POST | `/agent/projects/import` | `name`、`rootPath` | `ProjectSummary` | 400 路径非法、不可读或重复 |
| GET | `/agent/projects` | 无 | `List<ProjectSummary>` | — |
| DELETE | `/agent/projects/{id}` | 无 | 成功提示 | 400 项目不存在或无权访问 |

- Controller 只做协议适配，标注 `@ApiLog`；DTO 放 `server-network` 的 `dto/project` 包。
- `ProjectSummary` 仅含 `id`、`name`、`rootPath`、`importedAt`、`availability`，不含密钥等敏感字段。
- 这些接口仅面向本机桌面端，不设置远程多用户鉴权边界。

## 存储与安全

- `projects` 节点只存目录引用；后端不在项目目录内创建任何隐藏目录或运行态文件。
- 校验规则见上文 `importProject`；删除项目时**绝不删除用户目录**，只删除注册信息，并提示"项目内会话与运行态是否一并清理"（清理策略另行确定）。
- 文件 API 不再接受任意绝对路径，只接受已登记的 `projectId`；项目文件系统采用 AgentScope `ROOTED` 路径策略。Shell 仍是本机进程能力，执行工具继续走会话权限确认；OS 级强沙箱与符号链接真实目标校验列入后续安全增强。

## 前端交互

- 导入入口用 Tauri 目录选择器（`plugin-dialog` 的 `open({ directory: true })`）拿到路径；**后端不做目录浏览**。
- 侧边栏新增项目区：项目列表 + 导入/删除操作；新建会话时可选择所属项目。
- 独立 `services/projectApi.ts` 提供 import / list / remove，`services/projectPicker.ts` 封装桌面目录选择器，类型定义放 `types/`。
- 所有用户可见文案使用中文；空态提示"还没有项目，点击导入已有代码或新建空白项目"。

## 实施顺序

1. `ProjectRegistry` + 持久化 + 单元测试（路径规范化、拒绝系统目录、去重、往返读写、空目录允许）；
2. `AgentFactory` 权限根与 workspace 接缝改造（GENERAL 行为不变）；
3. `CreateSessionRequest` 绑定 `projectId` + `PROJECT` 会话启用；
4. Controller / DTO / API + 前端导入入口与项目区；
5. 验收：导入已有项目 → Agent 读写项目内文件且无法越界；导入空目录 → 可新建文件开发；GENERAL 会话与现在完全一致。

## 验收清单

- [x] 导入已有目录或空目录，规范化路径并持久登记
- [x] 项目会话持久绑定 `projectId`，不同项目使用不同 Agent 文件系统实例
- [x] 重复目录、磁盘根和用户主目录被拒绝
- [x] 删除接口只解除登记并将历史会话转为 GENERAL，不删除用户目录
- [x] 文件树只接受已登记项目 ID，跳过隐藏产物与符号链接
- [x] GENERAL 会话保持原有应用 workspace 行为
- [x] `plans/PLAN.md` 等运行态仍位于 `.butvan-agent` workspace
- [ ] 增加 OS 级 shell 沙箱及逐次解析符号链接真实目标的强边界

## 后续演进

- 项目级模型配置与自定义权限规则（按项目 `permissions.yaml`）；
- 项目文件索引、最近项目排序、多项目同时打开与切换；
- 若需要跨设备或多人协作，需迁移为服务端项目目录册与会话体系，不能继续依赖本地配置文件。
