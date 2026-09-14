# 开源 Agent 暂停、中断与恢复机制调研

> 调研日期：2026-09-13
>
> 范围：OpenHands、LangGraph、AutoGen、LibreChat、Open WebUI
>
> 来源约束：仅使用项目官方仓库中的源码与源码注释；链接固定到本次调研所读取的 commit。

## 1. 结论摘要

Agent 对话里的“停止”“中断”“暂停”“恢复”不是同一个动作。成熟实现普遍把它们拆成四层：

| 层次 | 解决的问题 | 不能保证的事情 |
| --- | --- | --- |
| Transport abort | 浏览器停止读取流、断开 SSE/WebSocket/fetch | 后端推理或工具一定停止 |
| Run cancellation | 找到指定 run/turn，发出取消信号并等待任务收敛 | 已发生的外部副作用自动回滚 |
| Cooperative pause | 模型、工具、子 Agent 在安全点观察暂停/取消信号 | 任意第三方调用都能立即响应 |
| Checkpoint/resume | 持久化可恢复状态，后续从明确边界继续 | 从任意一行代码精确续跑且不重放 |

对 ButvanAgent 最重要的启示是：第一版应把“停止当前轮次”做成可靠、可审计的 **run cancellation**，保留已生成内容并写入明确的 `CANCELLED` 终态；“可恢复暂停”应建立在持久化 checkpoint 和幂等工具协议之上，不应仅靠线程挂起或断开 SSE 模拟。

## 2. 项目证据

### 2.1 OpenHands：显式区分 pause 与 interrupt

调研 commit：[`28464621d879e3e9b3ceeae9d70a71d96da6212d`](https://github.com/All-Hands-AI/OpenHands/tree/28464621d879e3e9b3ceeae9d70a71d96da6212d)

OpenHands 前端的统一停止入口明确写出两种后端语义：云端 `pause` 会等待当前 LLM 调用结束，本地 `interrupt` 则取消进行中的请求；本地模式因此主动调用 `/interrupt`，而不是 `/pause`。[源码：`conversation-mutation-utils.ts` 35–61 行](https://github.com/All-Hands-AI/OpenHands/blob/28464621d879e3e9b3ceeae9d70a71d96da6212d/src/hooks/mutation/conversation-mutation-utils.ts#L35-L61)

这说明 UI 上即使只有一个“停止”动作，服务端也应区分：

- **优雅暂停**：设置暂停意图，在当前不可中断的模型/工具边界完成后停下；
- **立即中断**：向进行中的模型请求、工具任务和编排循环传播取消信号。

OpenHands 还揭示了另一个容易遗漏的边界：停止高层 `/goal` 循环只会记录 `interrupted`，不会自动终止当前 Agent turn；调用方还需要中断 conversation 才能真正停住。[源码：`conversation-mutation-utils.ts` 94–114 行](https://github.com/All-Hands-AI/OpenHands/blob/28464621d879e3e9b3ceeae9d70a71d96da6212d/src/hooks/mutation/conversation-mutation-utils.ts#L94-L114) 这意味着取消信号必须同时覆盖“外层编排任务”和“当前子任务”，不能只改一个数据库状态。

UI 状态不是从按钮本地猜测出来的。OpenHands 把服务端 `execution_status` 映射为 `RUNNING`、`PAUSED`、`AWAITING_USER_CONFIRMATION`、`FINISHED`、`ERROR` 等显示状态，并优先使用实时状态、REST 数据作为回退。[源码：`use-agent-state.ts` 9–77 行](https://github.com/All-Hands-AI/OpenHands/blob/28464621d879e3e9b3ceeae9d70a71d96da6212d/src/hooks/use-agent-state.ts#L9-L77) `/goal` 也有独立的 `running/complete/capped/interrupted` 生命周期事件，而非复用一个布尔量。[源码：`conversation-state-event.ts` 77–97 行](https://github.com/All-Hands-AI/OpenHands/blob/28464621d879e3e9b3ceeae9d70a71d96da6212d/src/types/agent-server/core/events/conversation-state-event.ts#L77-L97)

### 2.2 LangGraph：持久化中断与恢复是 checkpoint 协议

调研 commit：[`e539ac122f4126f6dd850581c1494948cf620e31`](https://github.com/langchain-ai/langgraph/tree/e539ac122f4126f6dd850581c1494948cf620e31)

LangGraph 的 `interrupt(value)` 是一种可恢复中断：第一次调用会抛出 `GraphInterrupt`、停止图执行并把中断载荷暴露给客户端；恢复时客户端传入 `Command(resume=...)`。该能力强制要求 checkpointer，因为恢复依赖持久化图状态。[源码：`types.py` 851–872 行](https://github.com/langchain-ai/langgraph/blob/e539ac122f4126f6dd850581c1494948cf620e31/libs/langgraph/langgraph/types.py#L851-L872) `Command` 还允许用 interrupt id 到值的映射来精确恢复多个中断点。[源码：`types.py` 798–824 行](https://github.com/langchain-ai/langgraph/blob/e539ac122f4126f6dd850581c1494948cf620e31/libs/langgraph/langgraph/types.py#L798-L824)

关键限制是：恢复会从节点开头重新执行，而不是从 `interrupt()` 后的指令地址继续。[源码：`types.py` 858–868 行](https://github.com/langchain-ai/langgraph/blob/e539ac122f4126f6dd850581c1494948cf620e31/libs/langgraph/langgraph/types.py#L858-L868) 因此中断点之前的写文件、发消息、下单等副作用必须幂等，或者被放到中断确认之后；否则恢复会重复执行。

LangGraph SDK 同时把网络连接语义与运行语义分开：`on_disconnect` 可选 `cancel` 或 `continue`，说明连接断开不必然等于任务取消；并发新任务则另有 `reject/interrupt/rollback/enqueue` 四种策略。[源码：`schema.py` 74–88 行](https://github.com/langchain-ai/langgraph/blob/e539ac122f4126f6dd850581c1494948cf620e31/libs/sdk-py/langgraph_sdk/schema.py#L74-L88) 流式 API 还可设置 `stream_resumable`，并明确列出 checkpoint、节点前后 interrupt 与 durability 参数。[源码：`runs.py` 200–268 行](https://github.com/langchain-ai/langgraph/blob/e539ac122f4126f6dd850581c1494948cf620e31/libs/sdk-py/langgraph_sdk/_async/runs.py#L200-L268)

运行取消本身是独立 API，并且带 `thread_id + run_id`、可选择等待终止，以及 `interrupt` 或 `rollback` 动作。[源码：`runs.py` 943–999 行](https://github.com/langchain-ai/langgraph/blob/e539ac122f4126f6dd850581c1494948cf620e31/libs/sdk-py/langgraph_sdk/_async/runs.py#L943-L999) 这比“按会话停止”更安全：一次会话可能已有新 run，旧页面的停止请求不应误杀新 run。

### 2.3 AutoGen：取消 token 与在线协作式 pause 是两套机制

调研 commit：[`027ecf0a379bcc1d09956d46d12d44a3ad9cee14`](https://github.com/microsoft/autogen/tree/027ecf0a379bcc1d09956d46d12d44a3ad9cee14)

AutoGen Core 提供线程安全的 `CancellationToken`。取消时设置标志并调用所有 callback；异步 Future 可通过 `link_future()` 绑定，token 已取消时也会立刻取消 Future。[源码：`_cancellation_token.py` 6–46 行](https://github.com/microsoft/autogen/blob/027ecf0a379bcc1d09956d46d12d44a3ad9cee14/python/packages/autogen-core/src/autogen_core/_cancellation_token.py#L6-L46) AgentChat 的模型调用、handoff tool、普通 tool 都继续接收同一个 cancellation token，例如 AssistantAgent 将 token 传给工具执行。[源码：`_assistant_agent.py` 1541–1603 行](https://github.com/microsoft/autogen/blob/027ecf0a379bcc1d09956d46d12d44a3ad9cee14/python/packages/autogen-agentchat/src/autogen_agentchat/agents/_assistant_agent.py#L1541-L1603)

这是一种很适合 ButvanAgent 的传播模型：Controller 不直接操作线程，而是 Run Registry 找到本轮 `CancellationToken`，由模型适配器、Tool Adapter、子 Agent 和异步 Future 共同订阅。

AutoGen 团队级 `pause()` / `resume()` 则是在线协作式协议：运行不会返回，runtime 分别向所有 participant 和 group-chat manager 发送 `GroupChatPause` / `GroupChatResume`。[源码：`_base_group_chat.py` 657–746 行](https://github.com/microsoft/autogen/blob/027ecf0a379bcc1d09956d46d12d44a3ad9cee14/python/packages/autogen-agentchat/src/autogen_agentchat/teams/_group_chat/_base_group_chat.py#L657-L746) 官方源码同时明确警告：参与者未实现 `on_pause/on_resume` 时是 no-op，能否正确暂停、续跑由 Agent 类自己负责。这种机制不能单独承担强一致的用户“停止”承诺。

AutoGen 另有团队状态导出/导入：保存所有 participant 和 group-chat manager 的状态，加载时覆盖团队状态；但源码警告运行中保存可能不一致，建议在停止后保存。[源码：`_base_group_chat.py` 748–809 行](https://github.com/microsoft/autogen/blob/027ecf0a379bcc1d09956d46d12d44a3ad9cee14/python/packages/autogen-agentchat/src/autogen_agentchat/teams/_group_chat/_base_group_chat.py#L748-L809) 因而“暂停后持久化”必须有一个已确认的安全点，不能在任意时刻序列化活动对象。

### 2.4 LibreChat：停止是 generation-scoped、竞态安全且先持久化终态

调研 commit：[`bd51be3`](https://github.com/danny-avila/LibreChat/tree/bd51be3)（完整 commit：仓库本次浅克隆的 HEAD）

> 注：下面的链接使用完整固定 commit `bd51be33261338fd2e19bc89a01d9435f2ae9548`。本地调研结果如与远端后续更新不同，以固定链接为准。

LibreChat 的可恢复 SSE 明确规定：离开页面只关闭流订阅，不停止后端 generation；只有用户显式点击停止，才调用后端 abort endpoint。[源码：`useResumableSSE.ts` 741–750 行](https://github.com/danny-avila/LibreChat/blob/bd51be33261338fd2e19bc89a01d9435f2ae9548/client/src/hooks/SSE/useResumableSSE.ts#L741-L750) 这是 transport abort 与 run cancellation 分离的直接实例。

停止请求不仅带 `conversationId`，还带精确 generation epoch `generationCreatedAt`，源码注释说明它用于阻止旧标签页误停同一会话中新启动的 turn。[源码：`mutations.ts` 6–30 行](https://github.com/danny-avila/LibreChat/blob/bd51be33261338fd2e19bc89a01d9435f2ae9548/client/src/data-provider/SSE/mutations.ts#L6-L30) 前端也不会在收到 abort HTTP ACK 后盲目清空状态，而是防止较晚返回的旧 abort 响应拆掉新 run。[源码：`useChatHelpers.ts` 216–253 行](https://github.com/danny-avila/LibreChat/blob/bd51be33261338fd2e19bc89a01d9435f2ae9548/client/src/hooks/Chat/useChatHelpers.ts#L216-L253)

服务端 abort 时使用 job 的创建时间作为条件，属于 generation 级 compare-and-set；而且在发布普通 abort FINAL 事件之前，先持久化用户消息、未完成 assistant 响应和必要 checkpoint 清理，失败时发布保守的 reconciliation frame，避免后续排队消息以尚未落盘的消息为 parent。[源码：`agents/index.js` 708–765 行](https://github.com/danny-avila/LibreChat/blob/bd51be33261338fd2e19bc89a01d9435f2ae9548/api/server/routes/agents/index.js#L708-L765)、[同文件 824–869 行](https://github.com/danny-avila/LibreChat/blob/bd51be33261338fd2e19bc89a01d9435f2ae9548/api/server/routes/agents/index.js#L824-L869)

LibreChat 的恢复接口也携带 `generationCreatedAt` 和 `actionId`；对于工具审批要求每个暂停的 `tool_call_id` 都有决策，过期或不匹配的 action 会被拒绝。[源码：`mutations.ts` 60–120 行](https://github.com/danny-avila/LibreChat/blob/bd51be33261338fd2e19bc89a01d9435f2ae9548/client/src/data-provider/SSE/mutations.ts#L60-L120) 这表明恢复不能只是 `POST /resume/{conversationId}`，还应验证恢复的是哪个 checkpoint、哪个待处理动作。

### 2.5 Open WebUI：本地取消、服务端任务取消和多实例广播

调研 commit：[`0a7c15832fb30b1903753e83f81dc7d27e5b0944`](https://github.com/open-webui/open-webui/tree/0a7c15832fb30b1903753e83f81dc7d27e5b0944)

Open WebUI 在单进程模式下从 task registry 取出 `asyncio.Task`，调用 `cancel()` 后 `await task`，根据 `CancelledError` / `done()` 返回结果，而不是发出取消请求就立即宣称已停止。[源码：`tasks.py` 232–266 行](https://github.com/open-webui/open-webui/blob/0a7c15832fb30b1903753e83f81dc7d27e5b0944/backend/open_webui/tasks.py#L232-L266)

多实例模式中，活动任务索引放在 Redis，通过 Pub/Sub 广播 `{action: stop, task_id}`；每个实例只取消自己持有的本地 task，Redis 清理采用幂等操作。[源码：`tasks.py` 14–54 行](https://github.com/open-webui/open-webui/blob/0a7c15832fb30b1903753e83f81dc7d27e5b0944/backend/open_webui/tasks.py#L14-L54)、[同文件 232–250 行](https://github.com/open-webui/open-webui/blob/0a7c15832fb30b1903753e83f81dc7d27e5b0944/backend/open_webui/tasks.py#L232-L250) ButvanAgent 当前是桌面单机应用，可先实现内存 registry；但接口应保留 `runId`，避免未来 sidecar 重启或多进程化时推倒重来。

前端停止函数同时调用服务端按 chat 停止任务、清理任务 id 和消息 loading 状态；如果还有本地生成请求，再执行 `AbortController.abort()`，最后按配置处理队列。[源码：`Chat.svelte` 3729–3777 行](https://github.com/open-webui/open-webui/blob/0a7c15832fb30b1903753e83f81dc7d27e5b0944/src/lib/components/chat/Chat.svelte#L3729-L3777) 服务端还会发 `chat:tasks:cancel`，前端收到后把响应标为完成并继续队列。[源码：`Chat.svelte` 1238–1249 行](https://github.com/open-webui/open-webui/blob/0a7c15832fb30b1903753e83f81dc7d27e5b0944/src/lib/components/chat/Chat.svelte#L1238-L1249) 这说明 UI 的最终收敛信号应来自后端事件，而本地 abort 只用于降低延迟和释放浏览器资源。

## 3. ButvanAgent 现状审计

当前代码并非从零开始，已经有一半取消基础：

- `AgentStreamSession.cancel()` 会设置标志并中断生产者虚拟线程；`AgentController.createEmitter()` 在 SSE 发送端结束或客户端断开时调用它。
- `AgentService` 会在事件循环检查取消状态，并通过 `AgentRunCompleter` 将已生成正文、thinking、工具和 usage 以 `CANCELLED` 终态写入 transcript。
- `AgentRunCheckpointService` 会保存运行中快照，`AgentRunRecoveryService` 在应用重启后将遗留运行收敛为 `CANCELLED`。这是崩溃收尾，不是可续跑恢复。
- 前端已以 `streamingSessionIds` 跟踪哪些会话正在生成，但 `streamAgentChat()` 没有接收 `AbortSignal`，也不返回可取消句柄；`PromptInput` 在生成期仍只有发送按钮。

关键缺口有六个：

1. **没有可寻址 run**：只有 `sessionId` 和生产者对象，Controller 返回 SSE 后没有 registry 能从另一个 HTTP 请求找到正在跑的那一轮。
2. **两种语义被一个布尔值混合**：“用户显式停止”需要保持 SSE 直到发出取消终态；“传输层已断开”则不能再发事件。当前 `cancelled` 同时表示两者。
3. **未调用 AgentScope 原生中断**：项目依赖的 AgentScope Java 2.0.0 已提供按 `userId + sessionId` 寻址的 `ReActAgent.interrupt(...)`，并在模型、工具边界检查中断。当前仅 `Thread.interrupt()`，不足以表达框架级取消。
4. **工具取消不安全**：`BashTool` 捕获了所有 `Exception`，可能吞掉 `InterruptedException`，且中断等待时没有保证销毁子进程及其进程树。其他网络工具也需要有界超时与取消适配。
5. **没有取消终态 SSE**：`AgentStreamEvent` 只有 `done/error/permission_required` 终态，前端会把 AbortError 误当连接失败，也无法区分“已接收取消”和“已完成取消”。
6. **checkpoint 不可恢复**：现有快照只保存展示和用量信息，没有下一步、待执行动作、AgentState 版本和幂等键，因而不能实现原 run 续跑。

## 4. 对 ButvanAgent 的推荐语义

### 4.1 产品术语

建议第一版只公开两个用户动作，避免“暂停”和“停止”语义混乱：

1. **停止当前回复**：尽快终止当前 run；保留已生成文本和已完成工具结果；不会撤销已经发生的文件、命令或外部系统副作用；不能直接恢复同一指令地址。
2. **继续对话**：在停止后的持久化历史上发起新 turn。可以由系统附加“上一轮被用户停止”的结构化上下文，但不是恢复旧线程栈。

后续需要 HITL、长任务或重启恢复时，再新增：

3. **暂停并等待**：只能发生在模型调用前后、工具调用前后等安全点，写入 checkpoint 后进入 `PAUSED`。
4. **恢复任务**：基于 `runId + checkpointId + pendingActionId` 恢复，从节点/步骤边界重放；工具必须有幂等键。

### 4.2 推荐状态机

```text
QUEUED -> RUNNING -> COMPLETED
             |  \-> FAILED
             |  \-> CANCELLING -> CANCELLED
             |  \-> PAUSING -> PAUSED -> RESUMING -> RUNNING
             \-> WAITING_FOR_CONFIRMATION -> RESUMING -> RUNNING
```

设计约束：

- `CANCELLING` 与 `PAUSING` 必须可见，避免用户连点和“按钮无响应”。
- `CANCELLED` 是终态；“继续”创建新 run。`PAUSED` 是非终态；“恢复”继续原 run。
- run 状态由后端持久化并通过 SSE 广播；前端本地状态只做 optimistic `CANCELLING`，最终以 SSE/查询结果为准。
- 每个终态事件携带 `conversationId`、`turnId/runId`、`status`、`reason`、`lastEventSeq`，前端只更新匹配 run，拒绝迟到事件污染新 run。

### 4.3 推荐后端分层

```text
REST Controller: POST /agent/chat/runs/{runId}/cancel
        |
        v
AgentRunCoordinator.cancel(userId, runId)
        |
        +-- RunRegistry: CancellationHandle / active Future / child run handles
        +-- Agent orchestrator: 每个模型、工具、SubAgent 边界检查 token
        +-- Persistence: partial assistant + run terminal state + usage
        +-- SSE: run.status(CANCELLED) / run.status(PAUSED)
```

建议采用如下顺序：

1. Controller 只校验身份和 DTO，取消逻辑进入 `AgentRunCoordinator`。该深模块的 interface 只需 `start(...)`、`cancel(...)` 和 `status(...)`，在内部集中 registry、竞态、框架中断与收尾复杂度。
2. 以 `userId + runId` 查询活动 run，再校验其 `sessionId`；重复取消返回当前状态，保证幂等。
3. 原子地把 `RUNNING` 改为 `CANCELLING`；若 runId/版本不匹配返回 `409 STALE_RUN`。
4. 取消外层编排 Future，并向模型适配器、工具和全部子 Agent 传播同一 token。
5. 对可取消 HTTP 调用关闭响应流；对子进程先发温和终止，超时后再强制终止；工具必须在 finally 中释放句柄。
6. 等待有界 grace period。无法即时取消的第三方调用保持 `CANCELLING`，到边界后收敛，不能提前谎报 `CANCELLED`。
7. 持久化 partial assistant、已完成 tool call、取消原因、usage 和终态，再发送 SSE 终态事件。

### 4.4 API 与事件最小契约

取消请求建议为：

```json
POST /agent/chat/runs/{runId}/cancel
{
  "sessionId": "session_...",
  "mode": "interrupt",
  "reason": "user_requested"
}
```

响应仅表示服务端已接管请求，不应让前端据此直接判定终态：

```json
{
  "runId": "run_...",
  "status": "CANCELLING",
  "accepted": true
}
```

最终 SSE：

```json
{
  "type": "run.status",
  "sessionId": "session_...",
  "runId": "run_...",
  "version": 8,
  "status": "CANCELLED",
  "reason": "user_requested",
  "partialMessageId": "msg_..."
}
```

新建轮次时由前端预先生成 UUID `runId` 并随现有 `/agent/chat/stream` 请求提交，因此首 token 到达前也能取消。后端另行生成持久化 `turnId`，并用首个 `run_started` 事件回传两者映射；客户端只允许匹配 `runId` 的事件更新当前消息。

如果 SSE 断线，第一版可通过 `GET /agent/chat/runs/{runId}` 查询最终状态并重新同步 session detail；待需要后台持续执行时，再加 `lastEventId` 事件补放。是否将“传输断开”视为取消应当是显式策略：当前 Tauri 单机版可保持 `cancel`，未来支持页面重连后切换为 `continue`。

## 5. 实施优先级

### P0：可靠停止当前轮次

- 引入稳定的 `runId/turnId`，贯穿请求、SSE、消息、usage 和运行态文件。
- 增加活动 Run Registry 和统一 cancellation token。
- 模型流、AgentScope 编排、Tool Adapter、SubAgent 逐层传播取消。
- 新增 `CANCELLING/CANCELLED` 状态及幂等 cancel API。
- partial assistant 消息以 `finishReason: cancelled` 落盘；终态后清理 `~/.butvan-agent/runs/*.json`，保持现有原始记录契约。
- 前端发送/停止按钮互换，停止后等待后端终态；迟到事件按 runId/version 丢弃。

### P1：取消安全与竞态测试

- 连续两轮中，旧轮 cancel 迟到不得取消新轮。
- 重复 cancel 幂等；自然完成与 cancel 竞争只允许一个终态。
- 模型尚未返回首 token、流式输出中、工具执行中、等待审批、SubAgent 执行中分别覆盖。
- SSE 断开/页面切换不得默认停止任务；重连后恢复正确状态。
- 取消后 partial message、usage、tool timeline 与终态一致，运行态临时文件被清理。

### P2：真正可恢复的暂停

- 定义 checkpoint schema：Agent 状态、下一步骤、pending tool/action、已提交副作用的 idempotency key、事件序号和 schemaVersion。
- 仅在安全点写 checkpoint；`PAUSED` 必须在 checkpoint 成功持久化后发布。
- 恢复 API 校验 `runId + checkpointId + actionId + version`，并防止重复恢复。
- 明确节点级重放语义；所有可重放工具提供幂等键或补偿策略。

### 建议的实施切片

**切片 A：运行协调与后端停止（必做）**

- 在 `server-agents/agent/run` 新增 `AgentRunCoordinator`、`AgentRunHandle`、`AgentRunStatus`和线程安全的活动 registry，每个 `runId` 只能完成一次。
- 把 `AgentService.streamAgent()` 收敛到 coordinator seam；取消时同时调用 AgentScope `getDelegate().interrupt(userId, sessionId)`、Reactor subscription dispose 和生产者线程 interrupt。
- 将 `AgentStreamSession` 的“用户请求取消”与“传输已关闭”拆开，增加 `Cancelled` 业务终态事件。
- 在 `AgentController` 增加带 `@ApiLog` 的 cancel/status 端点和独立 DTO，校验当前用户、session 归属与 run 匹配。

**切片 B：前端停止交互（必做）**

- 重构 `services/api.ts` 中的 `streamAgentChat()`：接收 `AbortSignal`，识别 `AbortError`，并解析 `run_started/run_status/cancelled` 事件。
- `App.tsx` 不再只存 `Set<sessionId>`，而是维护 `sessionId -> {runId, status, controller, assistantMessageId}`，丢弃不匹配 run 的迟到回调。
- `PromptInput` 在运行期把发送按钮原位替换为“停止”方块按钮；点击后先显示“正在停止…”，禁止重复点击，收到服务端终态后再恢复发送。
- 保留 partial assistant 内容，末尾显示“已停止”；不展示“连接失败”。

**切片 C：工具与子 Agent 取消安全（上线前必做）**

- 先修复 `BashTool`：单独处理 `InterruptedException`，恢复中断标记，终止进程树，关闭流并回收输出 Future；不再把取消包装成普通工具错误。
- 为模型 HTTP、Web Search 和后台子 Agent 增加取消 adapter；前台附属子 Agent 跟随父 run 级联取消，显式后台任务保持独立，并在 UI 中告知用户。
- 工具边界在执行前和执行后检查 token；已提交的写操作不声称回滚，继续依赖现有 `agent_tool_operation` 幂等约束。

**切片 D：可恢复暂停（后续独立需求）**

- 先完成 checkpoint schema 和工具幂等审计，再开放“暂停”按钮；否则产品只呈现“停止”。
- 复用现有权限恢复思路，但以 `runId + checkpointId + actionId/version` 防止过期恢复。

实施时建议 A+B+C 作为一个完整功能验收，D 单独立项。只做 B 会得到“按钮看似停了，后端仍可能运行”的假取消。

## 6. 不建议采用的捷径

- **只调用前端 `AbortController.abort()`**：这最多停止浏览器 fetch，后端可能继续花费 Token 和执行工具。
- **只把数据库状态改成 STOPPED**：运行线程、模型连接和子 Agent 不会因此自动停止。
- **按 conversationId 直接取消“当前任务”**：旧标签页和迟到请求会误杀新 turn；至少需要 runId，最好再带版本/创建时间 fence。
- **用 Java 线程 suspend/resume**：无法保证锁、I/O 与资源安全，也不能跨进程或重启恢复。
- **把取消当异常后丢弃 partial assistant**：用户看见的内容、transcript、usage 和调试事件会不一致。
- **声称能回滚工具副作用**：取消只能阻止尚未发生的步骤；已写文件、已发消息、已执行命令必须通过事务、幂等或补偿单独治理。

## 7. DOX 复核提示

若按本方案实施，将影响接口契约、运行工作流、持久化格式与用户体验，必须按根 `AGENTS.md` 做 DOX 复核。至少需要同步明确：

- `server-network` 的 cancel/resume DTO、HTTP 状态与 `@ApiLog`；
- `server-agents` 的 Run Registry、cancellation seam、checkpoint 归属和工具取消契约；
- `~/.butvan-agent/runs/*.json`、transcript 与 usage 在取消/恢复时的写入及清理规则；
- 前端 `services`、领域类型、共享按钮、SSE reducer 与状态文案。
