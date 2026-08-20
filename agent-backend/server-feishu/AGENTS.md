# server-feishu 工程规范

本文件是 `agent-backend/server-feishu/` 模块的强制性工作契约，遵循仓库根目录 `AGENTS.md`。

## 职责

- 本模块只负责即时通讯渠道集成（当前为飞书）：长连接事件接收、消息归一化处理、调用 Agent 并回复、渠道配置读取。
- 主动推送、卡片交互、其他渠道（企微、钉钉等）后续能力也归本模块。
- 不承载 Agent 编排、模型工厂、会话持久化等领域逻辑；这些必须复用 `server-agents` 的既有服务。

## 依赖与分层

- 只允许依赖 `server-agents` 及通用基础设施（Spring、飞书 SDK、Lombok）；禁止被 `server-agents` 反向依赖。
- 包结构：`butvan.agent.feishu.config`（配置读取）、`butvan.agent.feishu.service`（渠道服务）；禁止堆叠无职责说明的 common/utils 目录。
- 网络层通用能力（Controller、AOP、API 日志）仍留在 `server-network`，本模块不得重复实现。

## 配置与安全

- 飞书 App ID / App Secret 只从 `~/.butvan-agent/config.json` 的 `feishu` 节点读取，格式：
  `{ "enabled": true, "appId": "...", "appSecret": "..." }`。
- 禁止把密钥写入 yml、源码、日志或异常信息；日志中不得出现完整敏感请求体。
- 未配置或连接失败时只记录日志并跳过启动，不得阻塞主应用启动。
- 长连接生命周期由 `FeishuChannelLifecycle` 统一管理，禁止在业务代码中自行建立连接。
- 飞书渠道当前按用户显式决策启用“完全访问”：工具权限请求由渠道自动批准并继续执行，不再走桌面端审批。仅适用于机器人仅限本人使用的场景；如恢复审批，需同步还原 `FeishuAgentRunner` 中的自动批准逻辑。

## 验证与交付

- 新增逻辑至少执行 `mvn compile` 与贴近的单元测试，并说明未验证范围。
- 修改依赖或 SDK 用法后，说明已验证范围和遗留风险。
