# Tool Schema 按需加载调研与优化方案

> 调研日期：2026-09-12
> 范围：仅引用项目官方源码或官方文档；本文不包含业务代码修改。

## 1. 结论

当前一次对话输入合计 18,732 tokens，其中 Tool Schema 为 11,754 tokens，占 62.75%。结合本地计数明细，这 11,754 tokens 来自 2 次模型调用，每次均携带约 5,877 tokens、45 个工具。这个占比和重复发送量都明显偏高，优先级应高于继续压缩普通历史消息。

成熟项目的共同做法不是单纯缩短 JSON 字段，而是采用分层暴露：

1. 先按模式、权限、会话阶段和用户配置做确定性过滤。
2. 只把少量高频核心工具直接绑定给模型。
3. 其余工具按组激活，或通过 provider 原生 Tool Search 延迟加载。
4. 保持工具集合、排序和前缀稳定，以获得 Prompt Cache；同时把“工具目录缓存”与“模型输入缓存”分开统计。

对 ButvanAgent 最合适的第一阶段方案，是复用当前 AgentScope Java 2.0 的 `ToolGroup + reset_equipped_tools`，而不是立即自建一套检索协议。对于未来数量很大的 MCP 工具目录，再优先接入模型供应商原生 Tool Search；供应商不支持时，才使用 LangChain 式的动态工具选择器作为降级方案。

## 2. 一手证据

### 2.1 AgentScope Java：ToolGroup 与元工具动态换装

AgentScope Java 当前上游已经实现了按组暴露工具的完整链路：

- `ToolSchemaProvider.getToolSchemas()` 只为当前已激活的工具生成 schema；属于未激活分组的工具会被跳过：[ToolSchemaProvider.java L61-L109](https://github.com/agentscope-ai/agentscope-java/blob/e5caea1e7e37b690f5dee88cbacf6d6b54e2df8e/agentscope-core/src/main/java/io/agentscope/core/tool/ToolSchemaProvider.java#L61-L109)。
- `ReActAgent` 在每次推理前，根据状态中的已激活分组重新取得本轮 schema：[ReActAgent.java L2361-L2366](https://github.com/agentscope-ai/agentscope-java/blob/e5caea1e7e37b690f5dee88cbacf6d6b54e2df8e/agentscope-core/src/main/java/io/agentscope/core/ReActAgent.java#L2361-L2366)。
- 启用 Meta Tool 后，Toolkit 注册始终可用的 `reset_equipped_tools`：[Toolkit.java L767-L780](https://github.com/agentscope-ai/agentscope-java/blob/e5caea1e7e37b690f5dee88cbacf6d6b54e2df8e/agentscope-core/src/main/java/io/agentscope/core/tool/Toolkit.java#L767-L780)。该工具给模型看到的是分组名称和说明，而不是全部成员 schema，并以“替换当前激活组”的方式换装工具：[MetaToolFactory.java L39-L176](https://github.com/agentscope-ai/agentscope-java/blob/e5caea1e7e37b690f5dee88cbacf6d6b54e2df8e/agentscope-core/src/main/java/io/agentscope/core/tool/MetaToolFactory.java#L39-L176)。

这条路径直接减少模型可见的 schema，而不仅是减少注册或网络开销。项目当前在 [`agent-backend/pom.xml`](../agent-backend/pom.xml) 中使用 AgentScope Java 2.0.0；上述链接是固定到上游提交的当前实现，落地时仍需针对项目实际解析到的 2.0.0 artifact 做编译与恢复场景验证。

适用方式：将少量基础工具放入始终激活的基础组，其余按领域拆成有明确描述的组；模型可通过 `reset_equipped_tools` 自助换组，应用层也可在明确的任务阶段直接设置激活组。

主要权衡：切换分组会改变顶层 `tools` 数组，可能降低 provider 的前缀缓存命中率。因此分组应在任务阶段边界切换，并在阶段内保持稳定；不应每一轮都重新随机选择一套工具。

### 2.2 Anthropic Tool Search：长尾 schema 延迟进入模型上下文

Anthropic 官方 Tool Search 的工作方式是：服务端仍接收完整工具目录，但标记 `defer_loading: true` 的完整 schema 不进入模型初始上下文；模型先看到搜索工具，需要时得到 `tool_reference`，再把命中的完整 schema 展开到当前上下文：[Tool Search 官方文档](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool)。官方建议保留少数高频工具不延迟加载，其余长尾工具交给搜索。

Claude Code 的 MCP 文档说明 Tool Search 默认开启，启动时只加载工具名，完整 MCP schema 按需进入上下文；`ENABLE_TOOL_SEARCH=auto` 会在 MCP 工具描述超过上下文窗口约 10% 时启用，也可通过 `alwaysLoad` 为服务器或单个工具设置例外：[Claude Code MCP 文档](https://code.claude.com/docs/en/mcp)。Agent SDK 文档进一步指出，50 个工具可能消耗约 10K–20K tokens，Tool Search 通常只加载 3–5 个相关工具；代价是首次发现多一次往返，小于约 10 个工具时预加载往往更快：[Agent SDK Tool Search](https://code.claude.com/docs/en/agent-sdk/tool-search)。

这个实现还有一个重要优势：延迟工具在计算 Prompt Cache key 前被移除，因此新增延迟工具不会破坏已有前缀缓存；命中的 schema 以内联形式加入后续上下文：[Tool Reference 官方文档](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-reference)。

适用方式：未来接入大量 MCP 工具时，若模型供应商明确支持原生 deferred tools / Tool Search，则保留 3–5 个高频核心工具为 eager，其余长尾工具延迟加载。不能在供应商不支持搜索的情况下只隐藏 schema，否则模型将没有可达路径找到工具。

### 2.3 LangChain：请求级动态绑定与 provider 原生搜索适配

LangChain 提供两类互补的中间件：

- `LLMToolSelectorMiddleware` 先用选择模型挑选相关工具，再通过 `request.override(tools=...)` 只把选中的工具绑定给主模型；provider 自带工具会保留：[tool_selection.py L305-L353](https://github.com/langchain-ai/langchain/blob/348c9dc572599947d2d7d33d6a5b8b936e92a1d4/libs/langchain_v1/langchain/agents/middleware/tool_selection.py#L305-L353)。官方示例使用 `max_tools=3`，并通过 `always_include` 保留关键逃生工具；该方案适用于 10 个以上工具，但会增加一次选择模型调用：[Built-in middleware 官方文档](https://docs.langchain.com/oss/python/langchain/middleware/built-in)。
- `ProviderToolSearchMiddleware` 把指定工具标记为延迟加载，并向请求注入 provider 原生搜索工具：[provider_tool_search.py L120-L154](https://github.com/langchain-ai/langchain/blob/348c9dc572599947d2d7d33d6a5b8b936e92a1d4/libs/langchain_v1/langchain/agents/middleware/provider_tool_search.py#L120-L154)、[L209-L230](https://github.com/langchain-ai/langchain/blob/348c9dc572599947d2d7d33d6a5b8b936e92a1d4/libs/langchain_v1/langchain/agents/middleware/provider_tool_search.py#L209-L230)。

LangChain 还会把 `ToolRuntime` 这类运行时参数自动注入工具，并从 LLM 可见 schema 中隐藏。会话 ID、鉴权信息、状态和存储句柄等不应让模型填写的字段，都可以采用这种模式：[Tools 官方文档](https://docs.langchain.com/oss/python/langchain/tools)。

适用方式：把动态工具选择作为供应商不支持原生搜索时的降级层。选择器必须保留 `always_include` 工具，并把选择器自身 token、延迟和错误率计入总成本，不能只看主模型的 Tool Schema 数量。

## 3. 其他成熟实现的交叉验证

- OpenAI Codex 会在支持 Tool Search 时把 MCP 工具设为 `Deferred`，不支持时回退为 `Direct`，避免隐藏后不可达：[mcp_tool_exposure.rs L74-L94](https://github.com/openai/codex/blob/c4017a87aacc7558002b7cb510025e967c1d765e/codex-rs/core/src/mcp_tool_exposure.rs#L74-L94)。其本地检索使用 BM25，默认返回上限为 8 个工具：[tool_search.rs L140-L165](https://github.com/openai/codex/blob/c4017a87aacc7558002b7cb510025e967c1d765e/codex-rs/core/src/tools/handlers/tool_search.rs#L140-L165)、[tool_discovery.rs L5-L8](https://github.com/openai/codex/blob/c4017a87aacc7558002b7cb510025e967c1d765e/codex-rs/tools/src/tool_discovery.rs#L5-L8)。
- Continue 先按 Chat/Plan/Agent 模式、工具开关和工具组确定活跃集合；Chat 模式不发送工具，Plan 模式只保留只读内置工具：[selectActiveTools.ts L7-L34](https://github.com/continuedev/continue/blob/5522c6f44ca0ac3528b37244818fbfa39b5af470/gui/src/redux/selectors/selectActiveTools.ts#L7-L34)。请求时只向模型传活跃工具：[streamNormalInput.ts L97-L147](https://github.com/continuedev/continue/blob/5522c6f44ca0ac3528b37244818fbfa39b5af470/gui/src/redux/thunks/streamNormalInput.ts#L97-L147)。这证明确定性的模式过滤应作为第一层，而不必所有请求都调用选择模型。
- OpenAI Agents SDK 支持静态或按每次运行上下文动态过滤 MCP 工具：[MCP tool filtering](https://github.com/openai/openai-agents-python/blob/fbd2dbcaaf74a2c447c6d3fa9d5645d83fd7e292/docs/mcp.md#L521-L563)。它的 `cache_tools_list=True` 只是缓存远程 `tools/list` 结果：[MCP tool list caching](https://github.com/openai/openai-agents-python/blob/fbd2dbcaaf74a2c447c6d3fa9d5645d83fd7e292/docs/mcp.md#L612-L619)，可降低目录发现延迟，但不会减少已经发送给模型的 schema tokens。

## 4. ButvanAgent 推荐设计

### 4.1 三层工具暴露

| 层级 | 内容 | 策略 |
| --- | --- | --- |
| 核心层 | 换组/恢复、用户交互、极少数所有任务都需要的工具 | 始终暴露，目标不超过 5–8 个 |
| 领域组 | 文件只读、文件写入、终端、网络搜索、知识/记忆、项目配置、飞书渠道等 | 默认关闭；确定性路由预激活 1–2 组，模型可用 `reset_equipped_tools` 调整 |
| 长尾目录 | 第三方 MCP、用户自定义或低频工具 | provider 支持时延迟加载并搜索；否则先做 allowlist/denylist，再进入领域组或选择器 |

确定性路由的输入可以包括会话模式、Slash Command、显式工具指令、当前页面/功能域、权限以及任务阶段。只有无法确定领域且候选仍然很多时，才调用轻量选择模型。

### 4.2 Schema 精简边界

- 从 schema 中移除模型不应提供的运行时字段，例如身份、授权、会话、工作区路径和内部状态，由执行层注入。
- 清理重复 `title`、冗长枚举说明、无实际价值的 examples/default，但必须保留“何时使用、何时不使用、关键副作用、参数约束”等选择语义。
- 只合并同一领域、共享参数和权限边界的操作，避免把所有能力合并为一个含大量可选参数的“万能工具”。
- 工具名、分组名、schema 字段顺序和序列化方式保持稳定；只在阶段边界换组，以提高前缀缓存命中率。

### 4.3 缓存必须分开衡量

| 缓存 | 节省什么 | 不会节省什么 |
| --- | --- | --- |
| MCP `tools/list` 目录缓存 | MCP 往返和 schema 获取延迟 | 模型看到的 Tool Schema tokens |
| Provider Prompt Cache | 重复前缀的计费与推理延迟 | 逻辑输入 token 数和上下文占位 |
| Deferred Tool Search | 初始模型上下文中的完整长尾 schema | 搜索调用和命中 schema 后的上下文 |

因此不能用“启用了缓存”代替 Tool Schema 优化验收；仍需直接记录每轮实际暴露给模型的工具数和 schema token 数。

## 5. 实施顺序与验收指标

建议分三步推进：

1. **P0：统计与确定性过滤。** 逐工具统计 schema tokens，记录注册数量与实际暴露数量；按会话模式、权限和功能域先过滤明显不相关工具。
2. **P1：AgentScope ToolGroup。** 建立核心组和领域组，启用 `reset_equipped_tools`；默认只激活核心组及 1–2 个任务相关组，验证连续对话、换组、异常恢复和重启恢复。
3. **P2：长尾搜索。** MCP 目录明显扩大后，优先接入 provider 原生 deferred search；不支持时再增加本地 BM25 或选择模型，并保留直接暴露的安全降级路径。

当前每次调用约 5,877 Tool Schema tokens。第一阶段可将目标设为每次不超过 2,000 tokens，至少下降约 66%；如果跨领域任务成功率明显下降，再按实际数据提高预算，而不是恢复全部 45 个工具。

本次已落地 10 个能力组，并默认只暴露 `reset_equipped_tools`。按项目现有 `approximate-v1` 计数器，同一份元工具 Schema 约为 509 tokens，相比全量 5,877 tokens 下降约 91.3%；自动测试将默认 Schema 预算锁定在 800 tokens 以内。以截图中的记忆检索任务为例，首次路由约 509 tokens，启用 `memory` 后约为 1,178 tokens，两次调用累计约 1,687 tokens，较原来的 11,754 tokens 预计下降约 85.6%。代价是首次使用某个未激活能力组时会增加一次换组调用，因此仍需通过真实任务 A/B 验证总延迟和成功率。

每组至少使用 20–50 个代表性任务做 A/B，对比以下指标：

- 每轮注册工具数、实际暴露工具数、Tool Schema tokens，以及因多次模型调用产生的累计 schema tokens。
- 正确工具首选率、无工具可用率、错误换组率、需要恢复/重试的比例和端到端成功率。
- 主模型调用次数、选择/搜索额外调用次数，及 p50/p95 首 token 和任务总延迟。
- provider 报告的 input、cached input/cache read、output 和实际费用；本地归因估算不可代替供应商 Usage。

## 6. 风险与保护措施

- **路由漏工具：** 核心层必须保留换组/恢复能力；显式用户指令和权限规则优先于模型猜测。
- **缓存失效：** 分组在任务阶段内保持粘性，工具按稳定顺序序列化，避免每轮抖动。
- **额外选择成本：** 先用确定性路由；选择模型与搜索只处理长尾，并计入完整账单和延迟。
- **供应商能力差异：** 只有确认 provider 支持 deferred search 时才隐藏完整 schema；否则回退到 ToolGroup 或直接暴露。
- **过度压缩描述：** schema 更短不等于选择更准。每次压缩都应通过工具选择与参数正确率回归测试验证。
- **版本与恢复兼容：** AgentScope 上游实现与项目锁定版本可能存在差异，必须覆盖会话恢复、运行中换组以及进程重启后的激活状态测试。
