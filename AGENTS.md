# DOX framework

- DOX is highly performant AGENTS.md hierarchy installed here
- Agent must follow DOX instructions across any edits

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it

## Read Before Editing

1. Read the root AGENTS.md
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately. Small edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences, durable workflow rules, and the top-level Child DOX Index
- Child AGENTS.md files own domain-specific instructions and their own Child DOX Index
- Each parent explains what its direct children cover and what stays owned by the parent
- The closer a doc is to the work, the more specific and practical it must be

## Local Contracts

- **后端 REST API 日志打印契约**：所有后端 Controller REST API 接口方法必须标注 `@ApiLog("接口作用描述")` 自定义注解，触发 `ApiLogAspect` AOP 切面进行包含接口功能描述（Description）、请求参数、客户端 IP、处理状态及毫秒级耗时（Cost）的规范化日志输出。
- **前端模型配置引导契约**：未检测到模型配置时，必须使用全屏居中的独立配置页面（`ModelInitPage`），设计视觉风格须保持全屏纯白、椭圆双按钮（取消 / 继续）与极简排版，禁止使用浮层遮罩弹窗。

## User Preferences

- **持久化配置**：当用户配置模型信息时，所有配置文件托管在本地 `~/.butvan-agent/config.json` 中，解耦硬编码 yml 依赖。
- **代码与注释规范**：后端代码全量使用 Lombok 注解，并附带规范且详尽的中文 Javadoc 与注释。
- **接口日志输出**：后端每个 API 接口的调用必须通过 `@ApiLog` 注解触发规范化的日志输出打印（形如 `[API-LOG] START/END/ERROR` 并附带 Description 说明）。

## Child DOX Index

- No child AGENTS.md files are needed for the current repository structure.
- Root-owned files: `README.md`, `LICENSE`, `banner.jpg`, `video-thumbnail.jpg`, and root-level project documentation.