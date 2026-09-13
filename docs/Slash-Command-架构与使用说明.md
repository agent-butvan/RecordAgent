# Slash Command 架构与使用说明

## 目标与边界

Slash Command 是聊天输入框的本地路由层。它在普通消息进入 SSE 之前识别命令，并把命令分成三类：

- `LOCAL`：只操作当前桌面端状态或现有本地接口，不调用模型。
- `QUERY`：读取确定性业务数据并显示临时结果卡片，不调用模型、不写入聊天 Transcript。
- `CONTEXT_PROMPT`：把用户可见命令和服务端生成的数据上下文分开传给 Agent，会调用模型并记录 Token。

未知命令不会进入 Agent；`//` 用于发送以 `/` 开头的普通文本；`/Users/...` 等绝对路径不会被误识别为命令。

## 命令目录

| 类型 | 命令 | 行为 |
| --- | --- | --- |
| LOCAL | `/help [命令]` | 动态读取 Registry 并展示帮助。 |
| LOCAL | `/rename <新名称>` | 修改当前会话名称。 |
| LOCAL | `/status` | 展示模型、会话、权限、运行态、累计 Token、最近一次上下文估算和压缩状态；面板保持打开时随当前会话实时更新。 |
| LOCAL | `/tokens`、`/usage` | 打开 Token 用量面板。 |
| QUERY | `/today [日期]` | 聚合待办、日程、资料、花销和学习。 |
| QUERY | `/agenda [日期]` | 查看指定日期的待办与日程。 |
| QUERY | `/spending [today\|week\|month]` | 查看收支与支出分类。 |
| QUERY | `/study-report [today\|week\|month]` | 查看学习统计。 |
| QUERY | `/find-record <关键词>` | 检索资料轻量元数据。 |
| CONTEXT_PROMPT | `/ask-record ? <问题>` | 选择一篇资料后问答。 |
| CONTEXT_PROMPT | `/summarize-record ?` | 选择一篇资料后生成结构化摘要。 |
| CONTEXT_PROMPT | `/compare-records ? ?` | 依次选择两篇资料并比较。 |
| CONTEXT_PROMPT | `/daily-review [日期]` | 基于当天四类业务数据复盘；发送前逐次确认。 |
| CONTEXT_PROMPT | `/weekly-review [日期]` | 基于日期所在自然周复盘；发送前逐次确认。 |
| CONTEXT_PROMPT | `/todo-review [today\|week]` | 分析待办完成情况。 |
| CONTEXT_PROMPT | `/finance-review [week\|month]` | 分析最小化财务汇总；发送前逐次确认。 |
| CONTEXT_PROMPT | `/study-review [week\|month]` | 分析学习投入与记录。 |
| CONTEXT_PROMPT | `/study-plan <目标>` | 结合本月学习记录制定目标计划。 |

日期使用 `YYYY-MM-DD`；未填写日期时使用桌面端所在时区的今天。自然周从周一开始。

## 前端流程

Registry、解析和参数规则位于 `agent-frontend/src/features/slash-command/`。输入 `/` 后，选择器支持关键词过滤、上下键、Enter、Tab 和 Esc。命令结果与隐私确认卡片位于输入框上方，保持现有小圆角、描边、无阴影的视觉语言。

设置页“通用 → 指令配置”展示全部内置命令。用户可以逐条启用或禁用命令，也可以修改作用描述和用法；命令名作为执行标识保持只读。偏好保存在本机 `localStorage`，修改会即时影响命令建议、`/help` 和执行路由。恢复默认只清除帮助信息覆盖，不改变该命令的启用状态。

资料引用通过 `?` 打开异步分页选择器。候选项只加载 ID、标题、类型、日期、标签和摘要；选中后使用稳定 ID，并在输入框上方显示可移除 Chip。多资料引用不会使用标题反查。

## 服务端上下文与安全

`AgentChatRequest` 将三部分分开：

- `content`：用户可见命令，写入 Transcript。
- `recordReferenceIds`：稳定资料 ID，由后端校验所有权、归档和回收站状态后读取正文。
- `analysisContext`：受控的命令、范围、时区和本轮隐私确认，不包含业务正文。

资料正文和业务数据只能由后端按当前用户读取，并包裹为“不可信参考数据”。一次最多引用 4 篇资料，总预算 5 万字符；多篇资料公平分配预算。业务分析也限制为 5 万字符，并只暴露命令所需字段。

资料上下文按 `[1]`、`[2]` 稳定编号。模型回答被要求在关键结论后标记编号，并在末尾列出资料标题与简短依据；这属于回答格式约束，不会把资料正文写入 Transcript。

`/daily-review`、`/weekly-review` 和 `/finance-review` 含财务数据，因此每次都必须显示数据类型和时间范围并获得确认。确认不持久化。财务分析只发送收支汇总、每日趋势和分类金额，不发送账户余额或流水备注。`/spending` 是本地确定性查询，不会把数据发给模型。

资料或业务上下文在 Token 统计中归入 `RAG Context`；供应商实际用量和本地归因估算继续保持独立。长 Prompt 不写入 Transcript。

## 验证重点

- 解析、别名、未知命令、转义和 Registry 冲突。
- `LOCAL`、`QUERY` 命令不产生模型请求。
- 资料候选分页、稳定 ID、多引用去重和上下文预算。
- 服务端用户隔离、不可引用状态和注入边界。
- 所有含财务数据的模型命令必须逐次确认。
- 前端 lint、类型检查、生产构建和后端模块测试。

## 当前限制

- 资料附件、图片 OCR、PDF 分段检索尚未进入引用上下文。
- `/status` 的上下文值来自最近一次调用；模型未配置上下文上限时会明确显示“上限未知”。自动压缩已启用，但 AgentScope 尚未暴露最近一次压缩结果，因此界面会明确标记该状态暂不可用。
