# Jev 功能架构调研与演进建议（2026-09）

> 调研日期：2026-09-21
>
> 范围：ButvanAgent 当前 Jev Tool Schema 路由、AgentScope Java 接入方式，以及 GitHub 上可参考的渐进式工具发现架构。

## 1. 结论摘要

当前 Jev 功能不是完整的 Agent 架构，而是位于主模型调用前的“工具能力组预选器”。它把当前用户输入提交给 TypeSafe Jev，以 10 个能力组为候选进行多标签 Noul 判断，再把达到阈值的组投影到 AgentScope 的 Tool Schema 和会话执行状态。

现有实现的主要架构判断是正确的：

- Tool 的注册、执行、权限和 HITL 审批仍由 ButvanAgent 与 AgentScope 掌握，Jev 只做概率判断。
- 路由结果保存在每次运行独享的 `RuntimeContext`，不会直接修改跨会话共享的 Toolkit。
- `OFF / SHADOW / ACTIVE / FALLBACK` 支持灰度和故障放行。
- `reset_equipped_tools` 保留了模型侧的漏选补救能力。
- Schema 可见性与 AgentScope 的实际可执行组同步，避免“模型看得见、执行器却拒绝”的分裂状态。

但它目前仍是一个刚完成的 MVP，而不是已经通过生产评测的成熟路由系统。最关键的缺口不是再换一个 Agent 框架，而是：

1. 没有离线路由评测集和线上反馈闭环，默认 `0.75` 阈值缺乏项目数据支撑。
2. Shadow 结果只进入日志，无法计算每组 precision、recall、漏选率或模型补救率。
3. Jev 位于首 token 前的同步外部关键路径，最坏会增加约 3 秒等待，且调用期间无法及时响应取消。
4. 只使用当前轮 `displayContent`，对“继续处理它”“把刚才那个写入项目”等多轮承接请求召回不足。
5. 路由输入只有长度限制，没有敏感信息过滤、数据外发策略或用户可见说明。
6. ACTIVE 决策既是本轮状态，又被持久化到会话 `AgentState`，需要进一步明确“工具发现状态”和“长期会话状态”的边界。

GitHub 上存在更成熟的“工具发现”实现，尤其是 Spring AI 2.0 的 `ToolSearchToolCallingAdvisor`，但它属于 Spring AI 自己的工具调用循环，不能无成本嵌入 AgentScope。建议保留 AgentScope 主干，把当前方案升级为：

```text
确定性权限/风险策略
        ↓
本地候选检索（关键词/Lucene，规模扩大后再加向量）
        ↓
可插拔语义预选器（Jev，可关闭、可影子运行）
        ↓
按预算合并能力组、依赖组和常驻工具
        ↓
RuntimeContext 中的本轮 Tool Schema
        ↓
AgentScope 执行 + 独立权限/HITL
        ↓
结构化观测、离线回放和阈值校准
```

现阶段不建议迁移到 Spring AI、LangChain4j 或 LangGraph；建议借鉴它们的 ToolIndex、渐进式暴露、会话隔离、缓存淘汰和观测设计。

## 2. 当前实现的完整调用链

```text
AgentService.produceEvents
  ├─ 校验会话、保存用户消息
  ├─ ConversationContextAssembler 组装个人上下文
  ├─ 创建 RuntimeContext / AgentRun / checkpoint
  ├─ JevToolCapabilityRouter.route(displayContent, availableGroups)
  │    ├─ TypeSafeProperties 每轮读取 ~/.butvan-agent/config.json
  │    ├─ ToolCapabilityCatalog 生成 10 个 Noul 问题
  │    ├─ JevSystemOneAdapter POST /v1/systemone
  │    ├─ 校验每组 0..1 概率
  │    └─ 按统一 threshold 产生 ToolRoutingDecision
  ├─ 决策写入本轮 RuntimeContext
  ├─ ACTIVE 时同步到当前会话 AgentState.toolContext
  └─ HarnessAgent.streamEvents
       ├─ ToolSchemaSelectionMiddleware
       │    ├─ 保留 reset_equipped_tools
       │    ├─ 保留未分类兼容工具
       │    └─ 加入 Jev 选中的能力组 Schema
       ├─ 主模型推理/调用 Tool
       ├─ reset_equipped_tools 被调用后，AgentScope 会话状态接管
       └─ 权限审批、工具执行、SSE 与终态持久化
```

对应实现：

| 组件 | 职责 | 位置 |
| --- | --- | --- |
| `AgentService` | 在首个 Model Call 前发起路由，保存本轮决策并同步执行状态 | `agent-backend/server-agents/src/main/java/butvan/agent/agents/agent/AgentService.java` |
| `ToolCapabilityRouter` | 项目内可替换的路由 seam | `agent-backend/server-agents/src/main/java/butvan/agent/agents/routing/ToolCapabilityRouter.java` |
| `JevToolCapabilityRouter` | 构造问题、调用 Jev、校验概率、阈值选组、失败回退 | `agent-backend/server-agents/src/main/java/butvan/agent/agents/routing/JevToolCapabilityRouter.java` |
| `SystemOneGateway` | 隔离外部 TypeSafe API | `agent-backend/server-agents/src/main/java/butvan/agent/agents/routing/SystemOneGateway.java` |
| `JevSystemOneAdapter` | Spring `RestClient` HTTP Adapter | `agent-backend/server-agents/src/main/java/butvan/agent/agents/routing/JevSystemOneAdapter.java` |
| `ToolCapabilityCatalog` | 10 个能力组及 Tool 名称匹配规则的唯一目录 | `agent-backend/server-agents/src/main/java/butvan/agent/agents/tool/ToolCapabilityCatalog.java` |
| `ToolSchemaSelectionMiddleware` | 为每次 Model Call 生成本轮专属 Schema | `agent-backend/server-agents/src/main/java/butvan/agent/agents/tool/ToolSchemaSelectionMiddleware.java` |
| `ToolRoutingStateSynchronizer` | 将 ACTIVE 组同步到会话执行状态 | `agent-backend/server-agents/src/main/java/butvan/agent/agents/routing/ToolRoutingStateSynchronizer.java` |
| `TypeSafeProperties` | 每轮读取用户级 TypeSafe 配置 | `agent-backend/server-agents/src/main/java/butvan/agent/agents/config/TypeSafeProperties.java` |

当前目录定义 10 个能力组；源码中有 28 个项目业务 `@Tool` 注解，此外还有 AgentScope Harness 的内置工具。按“组”而不是按“具体 Tool”调用 Jev，能稳定候选空间，也符合一个任务同时需要多个能力的实际情况。

## 3. 设计优点

### 3.1 外部模型没有取得执行权

Jev 的输出只是候选能力组和概率。实际 Tool 是否存在、是否对模型可见、是否允许执行、是否需要审批，仍由本地代码和 AgentScope 决定。这一边界必须保留；语义路由不能等价于授权。

### 3.2 并发隔离方向正确

`HarnessAgent` 按项目根缓存，因此共享 Toolkit 不能承载某一轮的选择状态。当前实现把 `ToolRoutingDecision` 放入运行级 `RuntimeContext`，Middleware 只读完整 Toolkit 并创建新的 `ModelCallInput.tools()`，没有调用共享 Toolkit 的 `updateToolGroups`。

AgentScope 官方也把 `RuntimeContext` 定位为一次调用期间供 Middleware 和 Tool 协作的短生命周期载体，并提供 Tool Group/元工具用于按需暴露工具：[AgentScope Java Tool 文档](https://github.com/agentscope-ai/agentscope-java/blob/main/docs/v2/en/docs/building-blocks/tool.md)。

### 3.3 具备灰度与自救路径

- `SHADOW` 能在不影响主链路 Schema 的前提下请求 Jev。
- HTTP、配置或响应校验失败统一产生 `FALLBACK`，不会直接让聊天失败。
- `reset_equipped_tools` 常驻；Jev 漏选时，主模型仍能重新启用组。
- 模型显式调用元工具后，Middleware 不再用初始 Jev 结果覆盖它。

### 3.4 API Adapter 足够薄

HTTP 访问被隔离在 `SystemOneGateway` 后，连接超时 500ms、读取超时 3s，不记录 API Key 或用户原文。TypeSafe 官方把 Jev 定义为“非结构化状态输入、类型化概率决策输出”，当前 Noul 多标签方式符合这种接口定位：[TypeSafe Jev 官方发布说明](https://typesafe.ai/blog/introducing-system-one-models-and-jev)。

## 4. 主要问题与风险

### 4.1 没有证据证明默认阈值有效

所有能力组共用一个 `0.75` 阈值，但不同错误的代价并不相同：

- 漏掉 `web` 通常意味着回答不够新；
- 漏掉 `workspace` 可能使代码任务无法开始；
- 多选一个大组会增加 Schema token；
- 多选一个具有写操作的组不应自动提高权限，但会增加模型误调用机会。

类型安全只保证响应符合预先声明的结构，不保证语义判断一定正确。TypeSafe 官方发布材料也将概率定位为需要由业务代码解释的决策信号，而不是事实保证：[TypeSafe Jev 官方发布说明](https://typesafe.ai/blog/introducing-system-one-models-and-jev)。

建议至少支持：

- 每组独立阈值；
- `selected / uncertain / rejected` 三段区间；
- Tool Schema 数量或 token 总预算；
- 组依赖和强制常驻组；
- 模型版本变化后的重新校准。

### 4.2 Shadow 还不能形成评测闭环

当前成功日志包含组、概率和耗时，但 `JevUsage` 没有进入独立 usage ledger，也没有把下面这些结果关联到同一个 `runId`：

- 实际调用了哪些工具；
- 是否调用 `reset_equipped_tools` 补救；
- 是否出现 unavailable/unauthorized tool；
- 最终任务是否成功；
- 用户是否重试或改写请求。

因此 Shadow 目前只能“观察输出”，不能回答“路由是否正确”。

最低限度应记录不含用户原文的结构化事件：`runId`、catalog version、provider model、每组概率、选择结果、耗时、usage、fallback 原因、后续实际工具组、manual reset、任务终态。

### 4.3 首 token 延迟与取消传播不足

Jev 在 `AgentService` 的生产虚拟线程上同步执行。读取超时允许达到 3 秒，取消请求只能在 HTTP 返回或超时后被检查。MVP 选择 fail-open 是合理的，但成熟实现还应有：

- 覆盖连接与读取的总 deadline；
- 可取消 HTTP 调用；
- 按错误类型统计的熔断器；
- ACTIVE 关键路径不重试，Shadow 后台采样可有限重试；
- 超时、限流和服务故障的独立指标。

### 4.4 多轮语义不足

路由只接收 `displayContent`，而不是已经组装好的有界会话上下文。这样能减少隐私外发，却会漏掉多轮承接信息，例如：

- “把它保存下来”；
- “继续刚才的计划”；
- “查完后写进项目”；
- “把上一条改成已完成”。

不建议把完整 transcript 交给 Jev。更稳妥的是构造专门的 `RoutingContext`：当前用户文本、上一轮用户意图摘要、当前已激活组、显式附件/项目标志，并设置独立硬预算与敏感字段过滤。

### 4.5 数据外发边界不完整

输入虽然限制为 4,000 个 Java 字符，但没有：

- secret/凭据模式过滤；
- 用户级“允许语义路由外发”的产品开关说明；
- 项目或会话级禁用策略；
- 对高敏感内容仅使用本地路由的模式；
- 供应商、模型版本和数据类别审计记录。

长度限制解决成本问题，不等于解决隐私问题。

### 4.6 Catalog 的兼容性策略会长期积累债务

未分类工具被默认常驻，短期能避免新增 Tool 因忘记分组而静默消失；长期则可能让 Schema 再次膨胀，并绕过预期的能力分域。

成熟阶段应改为：注册时显式声明 `group / alwaysVisible / internalOnly`，CI 对未分类 Tool 失败；只为升级兼容保留有时限的兜底告警。

### 4.7 本轮状态与会话状态边界含混

Jev 决策放在运行级 `RuntimeContext`，但 ACTIVE 选择又覆盖并持久化 `AgentState.toolContext.activatedGroups`。这解决了 AgentScope ToolExecutor 的授权检查，却意味着一次瞬时判断会改变后续会话状态。

建议把概念拆开：

- `discoveredGroups`：本轮模型可见的候选组；
- `sessionEquippedGroups`：用户或主模型显式选择、需要跨轮延续的组；
- `executionAllowedGroups`：经过确定性权限策略后，本轮真正可执行的组。

在 AgentScope 当前执行约束下，可以继续把有效组投影到 `AgentState`，但要记录来源和版本，并明确终态后是否恢复或合并，而不是把“Jev 高概率”当作持久授权。

## 5. GitHub 成熟方案对比

### 5.1 AgentScope Java 2.0：当前主干本身就是合理基础

AgentScope Java 官方支持：

- 具名 Tool Group；
- 会话级激活状态；
- 内置元工具动态切换组；
- Middleware 在 Model Call/Acting 阶段改写行为；
- `RuntimeContext` 在单次调用中传递隔离状态；
- MCP、Skill 和权限系统。

来源：[AgentScope Java Tool 文档](https://github.com/agentscope-ai/agentscope-java/blob/main/docs/v2/en/docs/building-blocks/tool.md)、[AgentScope Java 仓库](https://github.com/agentscope-ai/agentscope-java)。

判断：当前项目没有必要为了工具路由替换 AgentScope。Jev 应继续是 AgentScope 上方的可插拔预选器，而不是新的执行框架。

### 5.2 Spring AI 2.0 Tool Search：最值得借鉴的 Java/Spring 架构

Spring AI 2.0 已把 `ToolSearchToolCallingAdvisor` 纳入官方核心。它采用渐进式 Tool Disclosure：

1. 对完整工具集合建立索引；
2. 初始只暴露 `toolSearchTool`；
3. 模型用自然语言搜索能力；
4. 命中的工具在后续模型轮次加入 Schema；
5. 会话内缓存索引，通过名称和描述指纹判断工具集变化；
6. 用 TTL/LRU 清理旧会话索引；
7. 支持 Lucene、向量和自定义 `ToolIndex`。

来源：[Spring AI Tool Search 文档](https://docs.spring.io/spring-ai/reference/api/tools/tool-search-tool.html)、[核心实现](https://github.com/spring-projects/spring-ai/blob/main/advisors/spring-ai-tool-search-advisor/src/main/java/org/springframework/ai/chat/client/advisor/toolsearch/ToolSearchToolCallingAdvisor.java)、[Spring AI 2.0 Release](https://github.com/spring-projects/spring-ai/releases)。

Spring 官方小规模基准报告了 34%–64% 的总 token 降幅，但同时增加模型请求轮次；这些结果是特定 28-tool 场景的厂商基准，不能直接当作 ButvanAgent 的收益承诺：[Spring AI Smart Tool Selection](https://spring.io/blog/2025/12/11/spring-ai-tool-search-tools-tzolov/)。

优点：Java/Spring 原生、索引和缓存治理完整、适合几十到上千工具、供应商无关。

缺点：它依赖 Spring AI 自己的 `ChatClient`/Advisor 工具循环，直接引入会与 AgentScope 重叠。

判断：这是最适合“借架构”的方案，不适合为了一个路由功能整体迁移。可移植的部分是 ToolIndex seam、fingerprint、会话隔离、渐进式追加、TTL/LRU 和 Micrometer/OTel 观测。

### 5.3 LangChain4j Tool Search：JVM 侧直接竞品，但功能仍标记 Experimental

LangChain4j 提供 `ToolSearchStrategy`：初始只显示搜索工具，搜索结果在一次 AI Service invocation 内累积，并提供关键词和向量两种内置策略。它还支持静态 Tool、动态 ToolProvider、MCP Tool 与 always-visible Tool。

来源：[LangChain4j Tool 文档](https://github.com/langchain4j/langchain4j/blob/main/docs/docs/tutorials/tools.md)、[LangChain4j 仓库](https://github.com/langchain4j/langchain4j)。

优点：Java、Tool Search 抽象清晰、动态工具和 MCP 兼容良好。

缺点：Tool Search 官方仍标记 `@Experimental`；迁移会替换现有 AgentScope Harness、状态、权限和 HITL 集成。

判断：适合作为接口设计参考，不构成当前项目迁移理由。

### 5.4 LangGraph BigTool：大规模 Tool Registry 参考

`langgraph-bigtool` 将 Tool 实例与可搜索元数据分开：Tool Registry 保存可执行对象，LangGraph Store 保存名称和描述向量；Agent 通过 `retrieve_tools` 取得少量 Tool ID，再执行对应工具。它支持内存/Postgres 存储以及完全自定义的检索函数。

来源：[langgraph-bigtool GitHub](https://github.com/langchain-ai/langgraph-bigtool)。

优点：适合数百或数千工具；Registry、Store、Retriever 的边界清晰。

缺点：Python/LangGraph 技术栈；通常多一次模型搜索回合；项目本身规模远小于 LangGraph 主仓库。

判断：当 ButvanAgent 未来接入大量 MCP Server 时，可借鉴其 Registry/metadata store 分离，不应迁移现有 Java 主栈。

### 5.5 TypeSafe Jev：适合做快速判断，但生态尚不成熟

TypeSafe 于 2026-09-15 发布 Jev，并明确仍处于 early access。其优势是一次请求并行返回受约束的概率判断，适合作为快速预选或安全门；但它不是 Tool Registry、执行器、权限系统、状态机或评测平台。

来源：[TypeSafe Jev 官方发布说明](https://typesafe.ai/blog/introducing-system-one-models-and-jev)。

判断：Jev 的接口很适合当前“10 个能力组多标签判断”，但发布仅数日，不能把供应商或社区生态视为成熟基础设施。必须保留本地 fallback、可替换 gateway 和独立评测。

## 6. 推荐目标架构

### 6.1 核心接口

建议把当前 `ToolCapabilityRouter` 扩展为更一般的 `ToolDiscoveryPolicy`，输出至少包括：

```text
catalogVersion
requestFingerprint
selectedGroups
uncertainGroups
scores
source               // rule / lexical / vector / jev / hybrid
providerModel
durationMillis
usage
fallbackReason
```

内部实现可以并存：

- `RuleBasedDiscovery`：项目类型、附件、明确 Slash Command、权限等确定性规则；
- `LexicalDiscovery`：基于名称、别名、描述、示例的本地关键词/Lucene 检索；
- `JevDiscovery`：当前 Jev 多标签判断；
- `HybridDiscovery`：合并本地候选、Jev 概率、组依赖和 token 预算。

### 6.2 路由和授权必须分层

```text
Tool Catalog
  ├─ Discovery metadata：名称、描述、别名、示例、相关组
  ├─ Schema metadata：参数、token 估算、模型可见说明
  └─ Security metadata：读写级别、权限、审批、数据域

Discovery 只决定“模型应该看到什么”
Security Policy 决定“本轮允许执行什么”
HITL 决定“这个具体调用是否获批”
```

任何 Jev、向量或 LLM 置信度都不得跳过权限与审批。

### 6.3 渐进式发现策略

当前只有 10 个稳定能力组，Jev 一次判断全部组并不昂贵，因此短期保留预选模式更合适。达到以下任一条件后，再引入 Tool Search：

- 可搜索组/工具超过约 20–30 个；
- Tool Schema 稳定超过约 5K–10K token；
- MCP 工具动态加入，Catalog 高频变化；
- 多个工具名称相似，主模型误选明显上升。

届时可以采用两级结构：

1. 本地索引从数百工具中召回 top-K 能力或工具；
2. Jev 对候选做多标签判断或不确定性门控；
3. 初始 Schema 加入高置信结果和一个搜索/重置元工具；
4. 模型需要时继续检索，结果只追加到当前运行；
5. Tool 执行前仍走 AgentScope 权限/HITL。

### 6.4 观测与评测闭环

建议建立 200–500 条中文路由样本，至少覆盖：

- no-tool 普通问答；
- 单组和多组任务；
- 多轮代词与省略主语；
- “搜索后写入”“查询后修改”等跨组链路；
- Prompt Injection；
- 含凭据、个人信息和大段粘贴文本；
- provider timeout、429、5xx、缺字段和概率非法；
- Jev 模型版本漂移。

核心指标：

| 指标 | 目的 |
| --- | --- |
| 每组 recall / false-negative rate | 工具路由首先要避免漏选 |
| precision / 平均选中组数 | 控制无关 Schema |
| manual reset rate | 衡量主模型补救频率 |
| unavailable tool rate | 发现 Schema 与执行状态不一致 |
| fallback rate | 衡量外部依赖可靠性 |
| p50/p95 route latency | 衡量首 token 影响 |
| Schema token 与总 token | 判断路由是否真正省成本 |
| task success / retry rate | 防止只优化分类指标却伤害任务完成率 |

对同一数据集离线比较：`all-tools`、`AgentScope meta-tool only`、`lexical only`、`Jev only`、`hybrid`。没有这组对照，不应把 ACTIVE 设为默认。

## 7. 分阶段实施建议

### P0：先把现有 MVP 变成可评估系统

1. 为路由事件增加 `runId`、catalog version、model version、usage 和 fallback reason。
2. 关联实际工具组、manual reset、终态和耗时，不记录用户原文。
3. 建立离线 fixture 与回放 runner，支持按组计算 precision/recall/FNR。
4. 增加多轮承接、敏感文本、取消、超时和模型响应漂移测试。
5. 保持默认 `SHADOW`；阈值由评测结果决定。

### P1：补齐策略层

1. 引入每组阈值、uncertain 区间、组依赖和 Schema token 预算。
2. 定义有界、可脱敏的 `RoutingContext`，只补充必要多轮信息。
3. 明确 `discovered / equipped / allowed` 三种状态。
4. 对未分类 Tool 增加注册告警，并逐步改为 CI 强校验。
5. 增加总 deadline、可取消 HTTP 与按错误分类的熔断观测。

### P2：工具规模扩大后加入本地 ToolIndex

1. 先实现关键词/Lucene baseline，不急于引入向量数据库。
2. Catalog 通过 fingerprint 增量更新索引。
3. 会话索引设置 TTL/LRU，避免无限增长。
4. 只在评测证明收益时引入向量检索或 Jev rerank。
5. 继续保留 `reset_equipped_tools` 或新的 `search_tools` 作为渐进补救入口。

## 8. 最终建议

当前实现可以继续保留，且不需要推倒重来。它已经具备清晰 seam、并发隔离、失败放行和模型自救，作为 Jev 刚发布阶段的 MVP 是合格的。

真正需要优先投入的是“证据层”：结构化观测、离线评测、阈值校准、多轮路由上下文和隐私策略。等 Tool 数量或 MCP 接入规模明显增长后，再借鉴 Spring AI Tool Search 的索引与渐进式发现架构。若现在直接迁移框架或引入向量检索，复杂度会先于真实收益到来。

## 9. 验证记录

本次调研执行了以下定向测试：

```bash
mvn -pl server-agents -am \
  -Dtest=TypeSafePropertiesTest,JevSystemOneAdapterTest,JevToolCapabilityRouterTest,\
ToolRoutingStateSynchronizerTest,ToolCapabilityCatalogTest,ToolSchemaSelectionMiddlewareTest \
  -Dsurefire.failIfNoSpecifiedTests=false test
```

结果：20 个测试全部通过，无失败、无错误。测试验证了配置安全关闭、HTTP 契约、Noul 校验、阈值选组、输入截断、失败回退、状态同步、Middleware 隔离和元工具接管；未验证真实 Jev 服务质量、端到端任务成功率、生产延迟和模型版本漂移。
