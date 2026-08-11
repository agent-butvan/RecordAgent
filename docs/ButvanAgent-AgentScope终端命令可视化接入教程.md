# ButvanAgent AgentScope 本地终端命令可视化与流式推拉接入教程

## 1. 这份文档解决什么问题

在当前 `ButvanAgent` 项目中，Agent 在执行本地终端 Shell 指令（如硬件诊断、电池检测、文件搜寻等）时存在以下痛点：
1. **前台无感知（黑盒体验）**：Agent 在后台触发 `BashTool` 或内置终端命令时，前端聊天界面完全无任何提示，用户容易误以为程序卡死或无响应。
2. **缺乏具体命令行与日志展示**：即使后端抛出了 `tool_call`，原代码中仅包含工具名称（如 `custom_bash`），未将具体的命令行 `$ command` 及执行结果日志实时透传至前端。
3. **缺少交互式 Terminal UI 组件**：前端没有专门为终端指令设计的展示容器。

**重构与接入核心目标**：
1. **对接 AgentScope 2.0 事件流**：AgentScope 2.0 中通过 `ToolCallStartEvent` 启动工具、`ToolCallDeltaEvent`（流式推送参数增量 `getDelta()`）拼接命令行参数、`ToolResultTextDeltaEvent` 提取终端输出内容。
2. **标准化 SSE 传输 Payload**：将 `tool_call` 与 `tool_result` SSE 事件升级为携带结构化 JSON 数据（包含工具名、命令行、执行状态、日志输出）的事件流。
3. **实现极致终端卡片（CommandCard）**：前端新增极具科技感、纯黑客 Terminal 风格的命令控制台卡片，支持实时显示命令行、状态指示灯（执行中/完成/错误）以及可展开/折叠的终端输出面板。

---

## 2. 核心原理与架构设计

整个终端命令前台可视化的流式交互链路如下：

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            AgentScope 终端命令可视化流式链路                      │
├──────────────────────────────────────────────────────────────────────────────────┤
│ 1. HarnessAgent 触发工具调用                                                     │
│     ↓                                                                            │
│ 2. AgentScope 事件流:                                                             │
│    - ToolCallStartEvent (开始, 获 toolCallId & toolCallName)                       │
│    - ToolCallDeltaEvent (流式参数增量, 累加 command JSON)                         │
│    - ToolCallEndEvent (参数生成完成, 触发 tool_call SSE)                          │
│    - ToolResultTextDeltaEvent (输出增量, 触发 tool_result SSE)                     │
│     ↓                                                                            │
│ 3. 通过 SSE 推送 JSON 数据到前端                                                  │
│     ↓                                                                            │
│ 4. 前端 api.ts 接收事件 -> App.tsx 更新消息列表 -> CommandCard 渲染终端控制台      │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**SSE 事件 Payload 结构定义**：

- **`tool_call` 事件**：
  ```json
  {
    "toolCallId": "call_123",
    "toolName": "custom_bash",
    "command": "pmset -g batt"
  }
  ```

- **`tool_result` 事件**：
  ```json
  {
    "toolCallId": "call_123",
    "toolName": "custom_bash",
    "result": "Now drawing from 'Battery Power'\n -InternalBattery-0 (id=12345) 98%; discharging..."
  }
  ```

---

## 3. 包结构与目录规划

本教程涉及的所有改动路径如下：

```text
Backend: agent-backend/server-agents/src/main/java/butvan/agent/agents/
├── agent/
│   ├── AgentStreamEvent.java      // [修改] 升级 ToolCall 与 ToolResult 数据记录结构
│   └── AgentService.java          // [修改] 结合 ToolCallDeltaEvent 累加解析 command 入参
│
Frontend: agent-frontend/src/
├── types/
│   └── chat.ts                    // [修改/新增] 定义 ToolCallItem 与 Terminal 卡片状态类型
├── services/
│   └── api.ts                     // [修改] 扩展 streamAgentChat 处理 tool_call / tool_result
├── components/chat/
│   ├── CommandCard.tsx            // [新增] 终端命令控制台卡片组件
│   └── CommandCard.module.css     // [新增] Terminal 极简黑客风格样式
└── App.tsx                        // [修改] 结合 SSE 回调更新聊天消息列表中的终端卡片
```

---

## 4. 第一步：升级后端 `AgentStreamEvent.java`

### 1.1 说明干什么的

修改 `AgentStreamEvent.java`，为 `ToolCall` 事件记录增加 `toolCallId` 和 `command` 字段，为 `ToolResult` 增加 `toolCallId` 和 `result` 字段。

### 1.2 完整代码实现

在 `agent-backend/server-agents/src/main/java/butvan/agent/agents/agent/AgentStreamEvent.java` 中更新代码：

```java
package butvan.agent.agents.agent;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

/**
 * Agent 对话流在业务层和网络层之间传递的标准事件。
 */
public sealed interface AgentStreamEvent permits
        AgentStreamEvent.Completed,
        AgentStreamEvent.Failed,
        AgentStreamEvent.TextDelta,
        AgentStreamEvent.ToolCall,
        AgentStreamEvent.ToolResult
{

    Logger log = LoggerFactory.getLogger(AgentStreamEvent.class);

    String eventName();
    Object payload();

    default boolean isTerminal() {
        return false;
    }

    /**
     * 模型正文文本增量。
     */
    record TextDelta(String content) implements AgentStreamEvent {
        @Override
        public String eventName() {
            return "text";
        }

        @Override
        public Object payload() {
            return content;
        }
    }

    /**
     * Agent 正常完成事件。
     */
    record Completed() implements AgentStreamEvent {
        @Override
        public String eventName() {
            return "done";
        }

        @Override
        public Object payload() {
            return "";
        }

        @Override
        public boolean isTerminal() {
            return true;
        }
    }

    /**
     * Agent 失败事件。
     */
    record Failed(String message) implements AgentStreamEvent {
        @Override
        public String eventName() {
            return "error";
        }

        @Override
        public Object payload() {
            return message;
        }

        @Override
        public boolean isTerminal() {
            return true;
        }
    }

    /**
     * 工具调用发起事件（包含 callId、工具名称及具体的命令行指令）
     */
    record ToolCall(String toolCallId, String toolName, String command) implements AgentStreamEvent {

        @Override
        public String eventName() {
            return "tool_call";
        }

        @Override
        public Object payload() {
            log.info("发起工具调用 callId: [{}], 工具: [{}], 指令: [{}]", toolCallId, toolName, command);
            return Map.of(
                    "toolCallId", toolCallId != null ? toolCallId : "",
                    "toolName", toolName != null ? toolName : "",
                    "command", command != null ? command : ""
            );
        }
    }

    /**
     * 工具调用结果事件
     */
    record ToolResult(String toolCallId, String toolName, String result) implements AgentStreamEvent {

        @Override
        public String eventName() {
            return "tool_result";
        }

        @Override
        public Object payload() {
            log.info("工具 callId: [{}] [{}] 调用完成，输出字节数: [{}]", toolCallId, toolName, result != null ? result.length() : 0);
            return Map.of(
                    "toolCallId", toolCallId != null ? toolCallId : "",
                    "toolName", toolName != null ? toolName : "",
                    "result", result != null ? result : ""
            );
        }
    }
}
```

---

## 5. 第二步：改造后端 `AgentService.java` 解析 AgentScope 流式 Event

### 2.1 说明干什么的

AgentScope 2.0 使用 `ToolCallDeltaEvent` 流式传输工具参数 JSON。我们通过在事件循环中维护一个按 `toolCallId` 缓冲参数的 Map，在 `ToolCallDeltaEvent` 中追加 `getDelta()` 增量，并在 `ToolCallEndEvent` 触发时解析 `command` 字段，抛出完整的 `ToolCall` 事件。

### 2.2 完整代码实现

在 `agent-backend/server-agents/src/main/java/butvan/agent/agents/agent/AgentService.java` 中更新事件循环处理：

```java
    /**
     * 消费 AgentScope 细粒度事件流，并转换为项目标准事件写入队列。
     */
    private void produceEvents(AgentUserCall request, AgentStreamSession session) {
        if (!modelHolder.isInitialized()) {
            putEvent(session, new AgentStreamEvent.Failed("请先完成模型配置。"));
            return;
        }

        String input = request != null && request.context() != null ? request.context() : "";
        RuntimeContext context = createRuntimeContext(request);
        boolean terminalEventSent = false;

        // 用于按 toolCallId 收集 AgentScope 流式工具参数增量
        Map<String, StringBuilder> toolArgsBuffer = new java.util.concurrent.ConcurrentHashMap<>();

        try (HarnessAgent agent = createHarnessAgent(modelHolder.getModel())) {

            UserMessage message = new UserMessage(input);

            for (AgentEvent event : agent.streamEvents(message, context).toIterable()) {
                if (session.isCancelled()) return;

                // 1. 处理工具参数流式增量 ToolCallDeltaEvent
                if (event instanceof ToolCallDeltaEvent deltaEvent) {
                    toolArgsBuffer.computeIfAbsent(deltaEvent.getToolCallId(), k -> new StringBuilder())
                            .append(deltaEvent.getDelta() != null ? deltaEvent.getDelta() : "");
                    continue;
                }

                // 2. 工具参数流结束 ToolCallEndEvent：提取并发送 ToolCall
                if (event instanceof ToolCallEndEvent endEvent) {
                    String toolCallId = endEvent.getToolCallId();
                    String toolName = endEvent.getToolCallName();
                    StringBuilder rawArgs = toolArgsBuffer.remove(toolCallId);
                    String command = parseCommandFromArgs(rawArgs != null ? rawArgs.toString() : "");

                    AgentStreamEvent toolCallEvent = new AgentStreamEvent.ToolCall(toolCallId, toolName, command);
                    if (!putEvent(session, toolCallEvent)) return;
                    continue;
                }

                // 3. 其他常规事件映射 (TextDelta, ToolResultTextDeltaEvent, AgentEndEvent)
                AgentStreamEvent mappedEvent = mapEvent(event);
                if (mappedEvent == null) continue;
                if (!putEvent(session, mappedEvent)) return;
                if (mappedEvent.isTerminal()) {
                    terminalEventSent = true;
                    break;
                }
            }

            if (!terminalEventSent && !session.isCancelled()) {
                putEvent(session, new AgentStreamEvent.Completed());
            }

        } catch (Exception exception) {
            if (session.isCancelled() || Thread.currentThread().isInterrupted()) {
                Thread.currentThread().interrupt();
                return;
            }
            log.error("Agent 流处理失败: sessionId={}", context.getSessionId(), exception);
            putEvent(session, new AgentStreamEvent.Failed("Agent 处理失败，请稍后重试。"));
        }
    }

    /**
     * 从模型生成的 JSON 参数字符串中提取 command 字段值
     */
    private String parseCommandFromArgs(String rawJson) {
        if (rawJson == null || rawJson.isBlank()) return "";
        try {
            com.fasterxml.jackson.databind.JsonNode node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(rawJson);
            if (node.has("command")) {
                return node.get("command").asText();
            }
            return rawJson;
        } catch (Exception e) {
            return rawJson;
        }
    }

    private AgentStreamEvent mapEvent(AgentEvent event) {
        if (event instanceof TextBlockDeltaEvent textEvent) {
            return new AgentStreamEvent.TextDelta(textEvent.getDelta());
        }
        if (event instanceof AgentEndEvent) {
            return new AgentStreamEvent.Completed();
        }
        if (event instanceof ToolResultTextDeltaEvent toolResultTextDeltaEvent) {
            return new AgentStreamEvent.ToolResult(
                    toolResultTextDeltaEvent.getToolCallId(),
                    toolResultTextDeltaEvent.getToolCallName(),
                    toolResultTextDeltaEvent.getDelta()
            );
        }
        return null;
    }
```

---

## 6. 第三步：升级前端 `src/services/api.ts` 事件分发

### 3.1 说明干什么的

修改前端 `api.ts` 的 `streamAgentChat` 函数，增加 `toolCallId` 传输支持。

### 3.2 完整代码实现

在 `agent-frontend/src/services/api.ts` 中更新代码：

```typescript
export interface ToolCallPayload {
  toolCallId?: string;
  toolName: string;
  command: string;
}

export interface ToolResultPayload {
  toolCallId?: string;
  toolName: string;
  result: string;
}

/**
 * Agent 对话流式 SSE 交互函数
 */
export async function streamAgentChat(
  params: { sessionId: string; context: string },
  onChunk: (text: string) => void,
  onComplete?: () => void,
  onError?: (error: Error) => void,
  onToolCall?: (data: ToolCallPayload) => void,
  onToolResult?: (data: ToolResultPayload) => void
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/agent/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`HTTP 响应异常: Status ${response.status}`);
    }

    if (!response.body) {
      throw new Error('ReadableStream 不可用');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let streamFinished = false;

    const dispatchSseEvent = (eventBlock: string) => {
      let eventName = 'message';
      const dataLines: string[] = [];

      for (const rawLine of eventBlock.split(/\r?\n/)) {
        if (rawLine.startsWith('event:')) {
          eventName = rawLine.substring(6).trim();
        } else if (rawLine.startsWith('data:')) {
          dataLines.push(rawLine.substring(5).trimStart());
        }
      }

      const dataStr = dataLines.join('\n');

      if (eventName === 'text' || eventName === 'message') {
        if (dataStr) onChunk(dataStr);
      } else if (eventName === 'tool_call') {
        try {
          const payload: ToolCallPayload = JSON.parse(dataStr);
          onToolCall?.(payload);
        } catch {
          onToolCall?.({ toolName: 'tool', command: dataStr });
        }
      } else if (eventName === 'tool_result') {
        try {
          const payload: ToolResultPayload = JSON.parse(dataStr);
          onToolResult?.(payload);
        } catch {
          onToolResult?.({ toolName: 'tool', result: dataStr });
        }
      } else if (eventName === 'error') {
        streamFinished = true;
        onError?.(new Error(dataStr || 'Agent 流式处理失败'));
      } else if (eventName === 'done') {
        streamFinished = true;
        onComplete?.();
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (buffer.trim()) dispatchSseEvent(buffer);
        if (!streamFinished) onComplete?.();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const eventBlocks = buffer.split(/\r?\n\r?\n/);
      buffer = eventBlocks.pop() || '';

      for (const eventBlock of eventBlocks) {
        if (eventBlock.trim()) dispatchSseEvent(eventBlock);
      }
    }
  } catch (error: unknown) {
    console.error('SSE 流数据解析失败:', error);
    onError?.(error instanceof Error ? error : new Error('SSE 流数据解析失败'));
  }
}
```

---

## 7. 第四步：前端终端控制台组件 `CommandCard`

与先前设计一致：
1. **新建组件样式**：`agent-frontend/src/components/chat/CommandCard.module.css`
2. **新建组件实现**：`agent-frontend/src/components/chat/CommandCard.tsx`

---

## 8. 第五步：在 `App.tsx` 中挂载终端卡片渲染

按 `toolCallId` 将 `toolCall` 附加到对话消息中，当收到 `toolResult` 时更新对应 ID 卡片状态。

---

## 9. 建议的实施顺序与验证方式

| 次序 | 修改内容 | 对应文件路径 | 成功验证标志 |
| --- | --- | --- | --- |
| 1 | 升级后端事件结构 | `AgentStreamEvent.java` | `ToolCall` 和 `ToolResult` 包含 `toolCallId` 字段。 |
| 2 | 解析 AgentScope 事件流 | `AgentService.java` | 利用 `ToolCallDeltaEvent` 收集参数，在 `ToolCallEndEvent` 完美打印 `$ command`。 |
| 3 | 前端 SSE 协议解析 | `src/services/api.ts` | 浏览器 Console 精准收到带有 `command` 的 `tool_call` 数据。 |
| 4 | 编写 Terminal 卡片组件 | `src/components/chat/CommandCard.tsx` | 渲染 macOS Terminal 风格容器。 |
| 5 | 集成到 UI 消息面板 | `src/App.tsx` | 提问“查看系统电池”时，界面实时展示 Terminal 指令卡片！ |
