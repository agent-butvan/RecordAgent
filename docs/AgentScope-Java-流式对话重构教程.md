# AgentScope Java 流式对话重构教程

## 1. 这份文档解决什么问题

当前项目已经可以把 AgentScope 的输出通过 SSE 发送给前端，但实现方式将三件事写在了同一处：

1. 创建 `HarnessAgent`；
2. 读取 AgentScope 事件；
3. 通过 `SseEmitter` 向浏览器写数据。

这种写法能先跑通文本输出，却会带来两个问题：

- 业务层依赖 Spring Web 的 `SseEmitter`，以后想改成 WebSocket、命令行或 Tauri 原生通道时无法复用；
- AgentScope 会产生文本、思考、工具调用、工具结果、结束等多种事件，但当前代码靠反射寻找 `getDelta()`，无法明确区分它们。

本教程的目标不是一次写完一个复杂框架，而是把流式能力拆成几个可独立验证的小步骤：**AgentScope 负责生产事件，队列负责跨线程传递，Controller 负责 SSE，前端负责解析 SSE。**

## 2. 先看清完整链路

```text
用户输入
  ↓
React 的 streamAgentChat() 通过 fetch 发起 POST 请求
  ↓
AgentController 接收请求，立即获得“本次流会话”
  ↓
AgentService 创建有界 BlockingQueue，并启动虚拟线程
  ↓
虚拟线程消费 HarnessAgent.streamEvents(...) 的 AgentEvent
  ↓
将 AgentScope 事件映射为本项目自己的流事件，写入队列
  ↓
Controller 的发送线程从队列 take() 事件，转换为 SSE
  ↓
浏览器按 event 名称解析；只有 text 写进聊天正文
```

这里有两个线程边界：

- **生产者线程**：等待模型输出并向队列写事件；它适合使用 Java 21 虚拟线程，因为等待模型网络流时不占用昂贵的平台线程。
- **消费者线程**：等待队列并调用 `SseEmitter.send(...)`；它只关心 HTTP 输出，不应知道 AgentScope 的类。

队列让这两个部分解耦。生产速度快时，队列暂存少量事件；浏览器慢或断开时，队列容量也能防止内存无限增长。

## 3. 要认识的 AgentScope 事件

项目使用的 AgentScope Java 2.x 应使用：

```java
harnessAgent.streamEvents(new UserMessage(input), runtimeContext)
```

它返回 `Flux<AgentEvent>`。重构的第一原则是：**使用具体类型判断事件，不使用反射猜测方法名。**

建议第一版关注以下事件：

| AgentScope 事件 | 本项目事件名 | 前端第一版如何处理 |
| --- | --- | --- |
| `TextBlockDeltaEvent` | `text` | 追加到助手回答正文。 |
| `ThinkingBlockDeltaEvent` | `thinking` | 暂存或展示“思考中”，不要混进正文。 |
| `ToolCallStartEvent` | `tool-call-start` | 展示“正在调用某工具”。 |
| `ToolCallDeltaEvent` | `tool-call-delta` | 可选：展示工具参数进度。 |
| `ToolCallEndEvent` | `tool-call-end` | 标记工具参数传输完成。 |
| `ToolResultTextDeltaEvent` | `tool-result` | 可选：展示工具执行过程。 |
| `AgentEndEvent` | `done` | 结束本次 SSE。 |
| Flux 的异常回调 | `error` | 给前端可展示的错误信息后结束。 |

不要一开始就在 UI 中展示全部事件。先正确传输 `text`、`done`、`error`，验证稳定后再逐个接入思考和工具状态。

## 4. 第一步：定义项目自己的流事件

在 `agent-backend/server-agents/.../agent/` 下新增 `AgentStreamEvent`。它是业务层与网络层的契约，不能直接把 `AgentEvent` 暴露给 Controller。

先从最小集合开始。下面的接口只描述事件，不负责发 HTTP，也不负责显示 UI：

```java
// sealed 表示事件类型只能是 permits 列出的几种，避免后续随意增加不受控事件。
public sealed interface AgentStreamEvent
        // 文本、正常结束、失败是第一版必须具备的三种状态。
        permits AgentStreamEvent.TextDelta,
                AgentStreamEvent.Completed,
                AgentStreamEvent.Failed {

    // SSE 的 event 名称，例如 "text"、"done"、"error"。
    String eventName();
    // SSE 的 data 内容；文本事件是字符串，未来工具事件可以是对象。
    Object payload();

    // 默认事件不会结束对话流；只有完成和失败事件需要覆盖它。
    default boolean isTerminal() {
        return false;
    }

    // record 自动生成构造器和 content() 读取方法，适合只携带数据的事件。
    record TextDelta(String content) implements AgentStreamEvent {
        // 前端看到 text 时，才把内容追加到助手回答正文。
        public String eventName() { return "text"; }
        // 这里返回本次新增的文本片段，不是整段回答。
        public Object payload() { return content; }
    }

    // 模型已正常结束，Controller 收到后应关闭 SSE 连接。
    record Completed() implements AgentStreamEvent {
        public String eventName() { return "done"; }
        // 完成事件没有额外内容，但 SSE 仍保留 data 字段。
        public Object payload() { return ""; }
        // 告诉消费者：不能继续等待下一条消息了。
        public boolean isTerminal() { return true; }
    }

    // 模型、网络或程序异常时使用；message 必须是可安全展示给用户的文案。
    record Failed(String message) implements AgentStreamEvent {
        public String eventName() { return "error"; }
        public Object payload() { return message; }
        public boolean isTerminal() { return true; }
    }
}
```

这一步完成后先停下来检查：该类不应导入 `SseEmitter`、`Controller` 或 React 相关概念。它只描述“发生了什么”。

## 5. 第二步：用会话对象承载队列和取消能力

不要只返回裸 `BlockingQueue`。裸队列无法表达“浏览器已经断开，模型任务应该停止”。建议创建一个小会话对象；先阅读每一行注释再实现：

```java
public final class AgentStreamSession {
    // 队列是生产者和消费者之间的缓冲区；最多缓存 64 条事件，避免无限占用内存。
    private final BlockingQueue<AgentStreamEvent> queue = new LinkedBlockingQueue<>(64);
    // 浏览器断开时将它改为 true，让生产者主动结束工作。
    private final AtomicBoolean cancelled = new AtomicBoolean(false);
    // 保存生产者虚拟线程，以便 cancel() 时可以唤醒正在阻塞的线程。
    private volatile Thread producerThread;

    // Controller 通过此方法拿到队列，然后持续 take() 等待下一条事件。
    public BlockingQueue<AgentStreamEvent> queue() {
        return queue;
    }

    // Service 启动生产者线程后调用，建立“会话知道自己线程”的关系。
    public void bindProducer(Thread thread) {
        this.producerThread = thread;
    }

    // 生产者每处理一个 AgentScope 事件前检查一次，避免无效继续工作。
    public boolean isCancelled() {
        return cancelled.get();
    }

    // 这是客户端断开或 SSE 已结束时的统一清理入口。
    public void cancel() {
        // 先设置标志；即使线程还未启动，也能在启动后看到取消状态。
        cancelled.set(true);
        if (producerThread != null) {
            // 如果线程正卡在 queue.put() 或等待模型流，interrupt 让它尽快醒来。
            producerThread.interrupt();
        }
    }
}
```

为什么队列容量选择 `64`：它足够容纳一小段模型增量，又能在客户端消费停止时限制内存。容量不是固定真理，后续应根据单个事件平均大小和并发会话数压测调整。

## 6. 第三步：让 AgentService 只生产事件

把 `AgentService.streamAgent(...)` 的返回类型从 `SseEmitter` 改成 `AgentStreamSession`。下面是一份**完整的第一版 `AgentService`**；其中已包含 `produceEvents`、`createHarnessAgent`、`createRuntimeContext`、`mapEvent` 和 `putEvent`，可以作为你实际改造时的骨架。

```java
package butvan.agent.agents.agent;

import butvan.agent.agents.model.ModelHolder;
import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.event.AgentEndEvent;
import io.agentscope.core.event.AgentEvent;
import io.agentscope.core.event.TextBlockDeltaEvent;
import io.agentscope.core.message.UserMessage;
import io.agentscope.core.model.Model;
import io.agentscope.harness.agent.HarnessAgent;
import io.agentscope.harness.agent.memory.compaction.CompactionConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.file.Paths;

/**
 * 只负责调用 AgentScope 并生产 AgentStreamEvent。
 * 注意：这里没有 SseEmitter，也没有任何 HTTP 代码。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentService {

    // ModelHolder 保存当前用户已经配置好的 AgentScope Model。
    private final ModelHolder modelHolder;

    /**
     * 对外入口：创建一个流会话，并立即在虚拟线程启动模型调用。
     * 该方法必须快速返回，不能等待模型回答完成。
     */
    public AgentStreamSession streamAgent(AgentUserCall request) {
        // 每一个聊天请求独占一个队列，不能让两个会话混用消息。
        AgentStreamSession session = new AgentStreamSession();

        // 虚拟线程内执行耗时的模型流读取；普通 Controller 线程可立即返回 SSE 响应。
        Thread producer = Thread.startVirtualThread(() -> produceEvents(request, session));

        // 记录线程，浏览器断开时 session.cancel() 才能中断这个生产者。
        session.bindProducer(producer);
        return session;
    }

    /**
     * 生产者方法：将 AgentScope AgentEvent 一条条翻译并写入队列。
     */
    private void produceEvents(AgentUserCall request, AgentStreamSession session) {
        // 未配置模型时，不要创建 Agent；直接向前端发送可展示的 error 事件。
        if (!modelHolder.isInitialized()) {
            putEvent(session, new AgentStreamEvent.Failed("请先完成模型配置。"));
            return;
        }

        // 从请求中读取用户输入；请求体为空时使用空字符串，避免空指针异常。
        String input = request != null && request.context() != null ? request.context() : "";
        // RuntimeContext 负责让 AgentScope 按 userId/sessionId 隔离会话记忆。
        RuntimeContext context = createRuntimeContext(request);
        boolean terminalEventSent = false;

        // try-with-resources 在流结束、异常或取消后关闭 HarnessAgent 相关资源。
        try (HarnessAgent agent = createHarnessAgent(modelHolder.getModel())) {
            // streamEvents 返回 Flux；toIterable 让“当前虚拟线程”逐条等待事件。
            for (AgentEvent event : agent.streamEvents(new UserMessage(input), context).toIterable()) {
                // 浏览器断开后，Controller 会调用 cancel()；此处立即停止模型事件消费。
                if (session.isCancelled()) {
                    return;
                }

                // 统一在此处把 AgentScope 第三方事件转换为项目自己的事件类型。
                AgentStreamEvent mappedEvent = mapEvent(event);
                if (mappedEvent == null) {
                    // 暂不需要展示的事件直接跳过，例如各种 StartEvent。
                    continue;
                }

                // 队列满时当前虚拟线程等待，形成背压，避免内存无限增长。
                if (!putEvent(session, mappedEvent)) {
                    // put 被中断通常代表会话已取消，直接结束即可。
                    return;
                }

                // done/error 已经进入队列，消费者会关闭 SSE；生产者不应继续读取。
                if (mappedEvent.isTerminal()) {
                    terminalEventSent = true;
                    return;
                }
            }

            // 理论上 AgentEndEvent 会产生 done；这里是防御性兜底。
            if (!terminalEventSent && !session.isCancelled()) {
                putEvent(session, new AgentStreamEvent.Completed());
            }
        } catch (Exception exception) {
            // cancel 导致的中断不应额外向已经断开的浏览器发送 error。
            if (session.isCancelled() || Thread.currentThread().isInterrupted()) {
                Thread.currentThread().interrupt();
                return;
            }

            // 服务端日志记录完整堆栈；前端只能收到安全、稳定的文案。
            log.error("Agent 流处理失败: sessionId={}", context.getSessionId(), exception);
            putEvent(session, new AgentStreamEvent.Failed("Agent 处理失败，请稍后重试。"));
        }
    }

    /**
     * 创建本次调用使用的 HarnessAgent。
     * 模型实例来自 ModelHolder；workspace 与压缩策略属于 Agent 运行配置。
     */
    private HarnessAgent createHarnessAgent(Model model) {
        return HarnessAgent.builder()
                // Agent 名称用于日志、工作区和可观测性标识。
                .name("butvan-agent")
                // 系统提示词定义 Agent 的基础行为；后续可独立提取为配置或 Prompt 文件。
                .sysPrompt("你是一个全能智能助手，请简洁、清晰地解答用户的各种技术与日常问题。")
                // 注入当前用户选择的 AgentScope Model，例如 OpenAI、Gemini 或 DashScope。
                .model(model)
                // AgentScope 用此目录保存工作区相关状态；生产环境应使用明确的绝对路径或配置项。
                .workspace(Paths.get(".agentscope/workspace"))
                // 对话达到 30 条消息时压缩上下文，并保留最近 10 条，避免上下文无限增长。
                .compaction(CompactionConfig.builder()
                        .triggerMessages(30)
                        .keepMessages(10)
                        .build())
                .build();
    }

    /**
     * 从前端请求生成 AgentScope 会话上下文。
     */
    private RuntimeContext createRuntimeContext(AgentUserCall request) {
        // 前端没有提供 sessionId 时使用默认值，保证 AgentScope 始终拿到非空会话标识。
        String sessionId = request != null && request.sessionId() != null && !request.sessionId().isBlank()
                ? request.sessionId()
                : "default_session";

        return RuntimeContext.builder()
                // sessionId 决定同一用户的哪段对话记忆被读取和保存。
                .sessionId(sessionId)
                // 当前项目尚未实现登录，因此暂时固定用户；接入登录后替换为真实用户 ID。
                .userId("butvan")
                .build();
    }

    /**
     * 将 AgentScope 的原始事件映射为项目约定的事件。
     */
    private AgentStreamEvent mapEvent(AgentEvent event) {
        // 文本增量：这是需要显示到聊天正文中的唯一事件。
        if (event instanceof TextBlockDeltaEvent textEvent) {
            return new AgentStreamEvent.TextDelta(textEvent.getDelta());
        }
        // Agent 生命周期结束：通知 Controller 发送 done 并关闭 SSE。
        if (event instanceof AgentEndEvent) {
            return new AgentStreamEvent.Completed();
        }
        // 第一版先忽略思考、工具等事件，等文本流稳定后再逐个增加分支。
        return null;
    }

    /**
     * 队列写入统一入口，负责处理中断，避免每个调用点重复 try/catch。
     */
    private boolean putEvent(AgentStreamSession session, AgentStreamEvent event) {
        try {
            session.queue().put(event);
            return true;
        } catch (InterruptedException exception) {
            // 保留中断信号，调用方据此停止生产。
            Thread.currentThread().interrupt();
            return false;
        }
    }
}
```

读这段完整代码时，请按顺序理解：`streamAgent` 负责启动，`produceEvents` 负责生产，`createHarnessAgent` 负责装配 Agent，`createRuntimeContext` 负责会话隔离，`mapEvent` 负责翻译事件，`putEvent` 负责安全入队。

注意：不要在 `doOnNext(...)` 中直接调用阻塞的 `queue.put(...)`。`doOnNext` 运行在哪个 Reactor 线程由上游决定；使用 `toIterable()` 并让虚拟线程等待，可以把阻塞边界限定在我们创建的虚拟线程内。

## 7. 第四步：扩展 AgentScope 事件映射

上面的完整 `AgentService` 已经实现了最小映射。文本稳定后，在同一个 `mapEvent(...)` 方法中依次扩展：

```java
// 模型产生思考增量时，单独发 thinking 事件，不能混入最终回答正文。
if (event instanceof ThinkingBlockDeltaEvent thinkingEvent) {
    return new AgentStreamEvent.ThinkingDelta(thinkingEvent.getDelta());
}
// 工具开始调用时，传递工具 ID 和名称，UI 可显示“正在调用 xxx”。
if (event instanceof ToolCallStartEvent toolEvent) {
    return new AgentStreamEvent.ToolCallStarted(
            toolEvent.getToolCallId(), toolEvent.getToolCallName());
}
```

这样做的好处是 AgentScope 升级时，变更只集中在 `mapEvent(...)`；Controller、前端 API 和聊天 UI 不需要了解第三方类。

## 8. 第五步：让 Controller 只做 SSE 转发

Controller 调用 Service 后立即返回 `SseEmitter`，并在另一个虚拟线程里消费队列：

```java
// 0L 表示由应用控制何时关闭，不让 Spring 因默认超时提前断开流。
SseEmitter emitter = new SseEmitter(0L);
// 此调用只创建队列和生产线程，会很快返回，不会阻塞 Controller 请求线程。
AgentStreamSession session = agentService.streamAgent(request);

// 发送线程专门负责“从队列取事件 → 写入 HTTP 响应”。
Thread sender = Thread.startVirtualThread(() -> {
    try {
        // 客户端仍连接且线程未被中断时，持续等待下一条业务事件。
        while (!Thread.currentThread().isInterrupted()) {
            // take() 在队列为空时等待；不需要手写轮询或 sleep。
            AgentStreamEvent event = session.queue().take();
            // SSE 同时写入 event 名称和 data 内容，浏览器据此区分事件类型。
            emitter.send(SseEmitter.event()
                    .name(event.eventName())
                    .data(event.payload()));
            // done/error 已经写出，跳出循环，finally 会做统一清理。
            if (event.isTerminal()) {
                return;
            }
        }
    } catch (IOException | IllegalStateException exception) {
        // 常见于用户关闭页面或网络断开；记录调试日志即可，不再向已断开的客户端发送错误。
        log.debug("SSE 客户端已断开", exception);
    } catch (InterruptedException exception) {
        // onCompletion 触发 interrupt 后会来到这里；必须恢复中断标记。
        Thread.currentThread().interrupt();
    } finally {
        // 无论正常结束、异常还是断开，都通知生产者停止。
        session.cancel();
        // 关闭 HTTP SSE 响应，释放 Spring 侧资源。
        emitter.complete();
    }
});

emitter.onCompletion(() -> {
    // 浏览器主动关闭连接时，中断消费者线程。
    sender.interrupt();
    // 同时取消仍可能运行的 AgentScope 生产者线程。
    session.cancel();
});
```

关键点：

- `Controller` 不创建 `HarnessAgent`，不识别 `TextBlockDeltaEvent`；
- `AgentService` 不导入 `SseEmitter`；
- 任意一侧结束时都调用 `session.cancel()`，避免断开客户端后生产者一直阻塞在队列上。

## 9. 第六步：前端按 SSE 事件边界解析

本项目采用 `fetch + ReadableStream`，因为浏览器原生 `EventSource` 不能直接发送 POST 请求体。不要再只按单行 `data:` 解析；SSE 的一条完整事件以空行分隔。

解析原则：

1. 用空行切分事件块；
2. 在一个事件块内读取 `event:` 和所有 `data:` 行；
3. 只有 `text` 调用 `onChunk`；
4. `error` 调用 `onError`；
5. `done` 调用 `onComplete`；
6. 先接收但忽略 `thinking`、工具事件，等 UI 准备好再展示。

核心伪代码如下：

```ts
function dispatchSseEvent(block: string) {
  // 从一个完整 SSE 事件块中读出 event: text / event: error 等事件名。
  const eventName = readEventName(block) ?? 'message'
  // SSE 允许一条事件有多行 data:；这里拼回原始内容。
  const data = readDataLines(block).join('\n')

  // 只有正文增量才进入聊天消息内容。
  if (eventName === 'text') onChunk(data)
  // error 不追加到正文，而是交给页面显示错误状态。
  if (eventName === 'error') onError?.(new Error(data))
  // done 表示可关闭“正在生成”的加载状态。
  if (eventName === 'done') onComplete?.()
}
```

不要把 `thinking`、`tool-call-*` 的数据直接追加到助手回答里，否则用户会看到工具参数 JSON 或内部过程与最终答案混在一起。

## 10. 建议的实施顺序与每一步验证

| 次序 | 本次只做什么 | 验证方式 | 成功标准 |
| --- | --- | --- | --- |
| 1 | 新增 `AgentStreamEvent` 的 `text/done/error` | 后端编译 | 不引入 Web 依赖。 |
| 2 | 新增 `AgentStreamSession` 与有界队列 | 单元测试 | 能写入、读取、取消。 |
| 3 | 改造 `AgentService` 生产队列事件 | 模拟 AgentScope 事件 | 文本顺序正确，异常转为 `error`。 |
| 4 | 改造 Controller 消费队列 | `curl -N` | 能收到 `event: text` 和 `event: done`。 |
| 5 | 改造 `streamAgentChat` 解析事件块 | 前端类型检查 | `text` 正常渲染，`error` 不进入正文。 |
| 6 | 接入 `thinking` 与工具事件 | 手工联调 | 状态单独展示，正文不被污染。 |
| 7 | 加入断开取消和超时 | 压测/手工中断请求 | 客户端断开后没有遗留生产线程。 |

每次只完成一行，不要同时改 AgentService、Controller 和前端。若本步骤失败，可立刻定位到当前层，而不是在整条链路里猜问题。

## 11. 联调时应观察什么

使用下面命令观察 SSE 原始内容：

```bash
# -N 禁用 curl 缓冲，终端才能立即看到每一小段 SSE 输出。
# 请求体只含会话 ID 和用户问题；请勿在终端历史中使用真实密钥。
curl -N -X POST http://localhost:8081/agent/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"demo","context":"你好"}'
```

预期结构：

```text
event: text
data: 你好

event: text
data: 我能帮你什么？

event: done
data:
```

出现异常时应是：

```text
event: error
data: Agent 处理失败，请稍后重试。
```

错误事件之后必须结束该流，不能再发送 `done`。日志可以记录异常堆栈，但 SSE 返回给前端的内容不能包含 API Key、完整请求内容或内部堆栈。

## 12. 完成后的代码职责

| 文件/模块 | 最终职责 |
| --- | --- |
| `AgentStreamEvent` | 定义本项目稳定的流协议。 |
| `AgentStreamSession` | 保存队列、取消状态和生产者线程。 |
| `AgentService` | 调用 AgentScope、映射事件、生产队列事件。 |
| `AgentController` | 消费队列并发送 SSE。 |
| `services/api.ts` | 解析 SSE 字节流并向 UI 回调。 |
| `ChatWorkspace` | 管理消息状态，只渲染应展示的事件。 |

按此边界实现后，未来替换 AgentScope、增加 WebSocket、加入工具调用展示或迁移到 Tauri 原生通信时，都只需改动相邻的一层。
