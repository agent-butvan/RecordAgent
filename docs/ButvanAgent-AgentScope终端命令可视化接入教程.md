# ButvanAgent AgentScope 本地终端命令可视化与流式推拉接入教程

## 1. 这份文档解决什么问题

在当前 `ButvanAgent` 项目中，Agent 在执行本地终端 Shell 指令（如硬件诊断、电池检测、文件搜寻等）时存在以下痛点：
1. **前台无感知（黑盒体验）**：Agent 在后台触发 `BashTool` 或内置终端命令时，前端聊天界面完全无任何提示，用户容易误以为程序卡死或无响应。
2. **缺乏具体命令行与日志展示**：即使后端抛出了 `tool_call`，原代码中仅包含工具名称（如 `custom_bash`），未将具体的命令行 `$ command` 及执行结果日志实时透传至前端。
3. **缺少交互式 Terminal UI 组件**：前端没有专门为终端指令设计的展示容器。

**重构与接入核心目标**：
1. **对接 AgentScope 2.0 事件流**：从 AgentScope 的 `ToolCallStartEvent` 中提取具体的工具调用参数（如 `command`），并在 `ToolResultTextDeltaEvent` / `ToolResultEvent` 中捕获终端输出内容。
2. **标准化 SSE 传输 Payload**：将 `tool_call` 与 `tool_result` SSE 事件升级为携带结构化 JSON 数据（包含工具名、命令行、执行状态、日志输出）的事件流。
3. **实现极致终端卡片（CommandCard）**：前端新增极具科技感、纯黑客 Terminal 风格的命令控制台卡片，支持实时显示命令行、状态指示灯（执行中/完成/错误）以及可展开/折叠的终端输出面板。

---

## 2. 核心原理与架构设计

整个终端命令前台可视化的流式交互链路如下：

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            AgentScope 终端命令可视化流式链路                      │
├──────────────────────────────────────────────────────────────────────────────────┤
│ 1. HarnessAgent 执行 Shell 指令 (如 custom_bash)                                  │
│     ↓                                                                            │
│ 2. 触发 AgentScope 事件: ToolCallStartEvent (包含 toolCallName & 入参 json)        │
│     ↓                                                                            │
│ 3. AgentService.mapEvent() 解析出 command 命令行, 包装为 AgentStreamEvent.ToolCall│
│     ↓                                                                            │
│ 4. 通过 SSE 推送 event: tool_call 到前端                                          │
│     ↓                                                                            │
│ 5. 工具执行完毕触发 ToolResultEvent, AgentService 转换为 tool_result 推送 SSE      │
│     ↓                                                                            │
│ 6. 前端 api.ts 接收事件 -> App.tsx 更新消息列表 -> CommandCard 渲染终端控制台      │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**SSE 事件 Payload 结构定义**：

- **`tool_call` 事件**：
  ```json
  {
    "toolName": "custom_bash",
    "command": "pmset -g batt"
  }
  ```

- **`tool_result` 事件**：
  ```json
  {
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
│   └── AgentService.java          // [修改] 捕获 ToolCallStartEvent 中的入参 command
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

修改 `AgentStreamEvent.java`，为 `ToolCall` 事件记录增加 `command` 字段（保存具体执行的命令），为 `ToolResult` 增加 `result` 字段，并将其序列化为包含工具名的 Map 对象，方便控制层导出为标准 JSON 格式推送给前端。

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
     * 工具调用发起事件（包含工具名称及具体的命令行指令）
     *
     * @param toolName 工具名称
     * @param command  调用的具体指令或参数
     */
    record ToolCall(String toolName, String command) implements AgentStreamEvent {

        @Override
        public String eventName() {
            return "tool_call";
        }

        @Override
        public Object payload() {
            log.info("发起工具调用，工具: [{}], 指令: [{}]", toolName, command);
            return Map.of(
                    "toolName", toolName != null ? toolName : "",
                    "command", command != null ? command : ""
            );
        }
    }

    /**
     * 工具调用结果事件
     *
     * @param toolName 工具名称
     * @param result   输出结果内容
     */
    record ToolResult(String toolName, String result) implements AgentStreamEvent {

        @Override
        public String eventName() {
            return "tool_result";
        }

        @Override
        public Object payload() {
            log.info("工具 [{}] 调用完成，输出字节数: [{}]", toolName, result != null ? result.length() : 0);
            return Map.of(
                    "toolName", toolName != null ? toolName : "",
                    "result", result != null ? result : ""
            );
        }
    }
}
```

---

## 5. 第二步：改造后端 `AgentService.java` 解析命令入参

### 2.1 说明干什么的

修改 `AgentService.java` 中的 `mapEvent` 方法：
1. 当捕获到 AgentScope 的 `ToolCallStartEvent` 时，通过其 `getCallArgs()` 提取 JSON 参数中的 `command`。
2. 当捕获到 `ToolResultEvent` 或 `ToolResultTextDeltaEvent` 时，将其输出包裹为带有工具名的 `AgentStreamEvent.ToolResult`。

### 2.2 完整代码实现

在 `agent-backend/server-agents/src/main/java/butvan/agent/agents/agent/AgentService.java` 中替换 `mapEvent` 方法：

```java
    /**
     * 将 AgentScope 原始事件转换为应用流事件。
     *
     * @param event AgentScope 原始事件
     * @return 应用流事件；不需要向前端输出的事件返回 {@code null}
     */
    private AgentStreamEvent mapEvent(AgentEvent event) {
        if (event instanceof TextBlockDeltaEvent textEvent) {
            return new AgentStreamEvent.TextDelta(textEvent.getDelta());
        }
        if (event instanceof AgentEndEvent) {
            return new AgentStreamEvent.Completed();
        }

        // 捕获工具发起事件并解析 command 参数
        if (event instanceof ToolCallStartEvent toolCallStartEvent) {
            String toolName = toolCallStartEvent.getToolCallName();
            String command = "";
            
            // 尝试从 AgentScope ToolCallStartEvent 中提取参数字段
            if (toolCallStartEvent.getCallArgs() != null) {
                Object cmdObj = toolCallStartEvent.getCallArgs().get("command");
                if (cmdObj != null) {
                    command = cmdObj.toString();
                } else {
                    command = toolCallStartEvent.getCallArgs().toString();
                }
            }
            
            return new AgentStreamEvent.ToolCall(toolName, command);
        }

        // 捕获工具输出结果事件
        if (event instanceof ToolResultTextDeltaEvent toolResultTextDeltaEvent) {
            return new AgentStreamEvent.ToolResult(
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

修改前端 `api.ts` 的 `streamAgentChat` 函数，让其支持回调 `onToolCall` 和 `onToolResult`，并在接收到对应 SSE 事件时解析 JSON 内容。

### 3.2 完整代码实现

在 `agent-frontend/src/services/api.ts` 中替换 `streamAgentChat` 的实现：

```typescript
export interface ToolCallPayload {
  toolName: string;
  command: string;
}

export interface ToolResultPayload {
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

## 7. 第四步：新建前端终端控制台组件 `CommandCard`

### 4.1 说明干什么的

创建专用的终端卡片 UI 组件，具有以下特点：
- **Terminal Header**：带有标准的 macOS 三色控制点（红黄绿）和 `bash` 提示。
- **Command Line**：动态渲染带高亮的 `$ bash command` 指令。
- **Status Indicator**：状态包括 `running`（脉冲转圈动画）、`completed`（绿色打勾）、`failed`（红色交叉）。
- **Terminal Output**：折叠面板，点击可展开查看实时输出的控制台控制文本。

### 4.2 完整代码实现与 CSS

1. **新建组件样式**：`agent-frontend/src/components/chat/CommandCard.module.css`

```css
.cardContainer {
  background-color: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  margin: 10px 0;
  overflow: hidden;
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  max-width: 100%;
}

.header {
  background-color: #161b22;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #21262d;
  user-select: none;
}

.windowButtons {
  display: flex;
  gap: 6px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dotRed { background-color: #ff5f56; }
.dotYellow { background-color: #ffbd2e; }
.dotGreen { background-color: #27c93f; }

.title {
  color: #8b949e;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.statusTag {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
}

.running {
  background-color: rgba(56, 139, 253, 0.15);
  color: #58a6ff;
  border: 1px solid rgba(56, 139, 253, 0.3);
}

.completed {
  background-color: rgba(46, 160, 67, 0.15);
  color: #3fb950;
  border: 1px solid rgba(46, 160, 67, 0.3);
}

.body {
  padding: 12px;
  color: #c9d1d9;
  font-size: 13px;
}

.commandLine {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  word-break: break-all;
}

.prompt {
  color: #2f81f7;
  font-weight: bold;
}

.commandText {
  color: #79c0ff;
  font-weight: 600;
}

.toggleBtn {
  margin-top: 8px;
  background: none;
  border: none;
  color: #8b949e;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0;
}

.toggleBtn:hover {
  color: #c9d1d9;
}

.outputArea {
  margin-top: 8px;
  background-color: #010409;
  border: 1px solid #21262d;
  border-radius: 6px;
  padding: 10px;
  max-height: 240px;
  overflow-y: auto;
  font-size: 12px;
  line-height: 1.4;
  color: #7d8590;
  white-space: pre-wrap;
  word-break: break-all;
}
```

2. **新建组件实现**：`agent-frontend/src/components/chat/CommandCard.tsx`

```tsx
import React, { useState } from 'react';
import { Terminal, ChevronDown, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react';
import styles from './CommandCard.module.css';

export interface CommandCardProps {
  toolName: string;
  command: string;
  status: 'running' | 'completed' | 'failed';
  output?: string;
}

export const CommandCard: React.FC<CommandCardProps> = ({
  toolName,
  command,
  status,
  output,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className={styles.cardContainer}>
      <div className={styles.header}>
        <div className={styles.windowButtons}>
          <span className={`${styles.dot} ${styles.dotRed}`} />
          <span className={`${styles.dot} ${styles.dotYellow}`} />
          <span className={`${styles.dot} ${styles.dotGreen}`} />
        </div>
        <div className={styles.title}>
          <Terminal size={14} />
          <span>{toolName || 'Terminal Exec'}</span>
        </div>
        <div className={`${styles.statusTag} ${styles[status]}`}>
          {status === 'running' && (
            <>
              <Loader2 size={12} className="animate-spin" />
              <span>执行中...</span>
            </>
          )}
          {status === 'completed' && (
            <>
              <CheckCircle2 size={12} />
              <span>完成</span>
            </>
          )}
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.commandLine}>
          <span className={styles.prompt}>$</span>
          <span className={styles.commandText}>{command || '执行本地命令...'}</span>
        </div>

        {output && (
          <>
            <button
              className={styles.toggleBtn}
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>{isExpanded ? '收起控制台输出' : '查看控制台输出'}</span>
            </button>

            {isExpanded && (
              <pre className={styles.outputArea}>
                <code>{output}</code>
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  );
};
```

---

## 8. 第五步：在 `App.tsx` 中挂载终端卡片渲染

### 5.1 说明干什么的

修改 `App.tsx` 的消息处理逻辑，当触发 `onToolCall` 时向当前 Agent 消息中压入一个 Tool 命令节点，当触发 `onToolResult` 时更对应 Tool 命令节点的状态与日志。

### 5.2 完整代码集成片段

在 `agent-frontend/src/App.tsx` 的消息流处理处进行更新：

```tsx
// 1. 定义扩展消息项接口
interface ToolExecution {
  id: string;
  toolName: string;
  command: string;
  status: 'running' | 'completed' | 'failed';
  output?: string;
}

// 2. 在 App 对话调用流中传入 onToolCall 与 onToolResult
await streamAgentChat(
  { sessionId, context: inputPrompt },
  (textDelta) => {
    // 正常文本渲染逻辑
    setMessages((prev) => updateLastAssistantMessageText(prev, textDelta));
  },
  () => {
    setIsLoading(false);
  },
  (error) => {
    console.error('Chat error:', error);
    setIsLoading(false);
  },
  (toolCall) => {
    // 捕获到工具调用，向当前消息附加命令卡片数据
    setMessages((prev) => appendToolCallToLastMessage(prev, toolCall));
  },
  (toolResult) => {
    // 捕获到工具输出，更新命令卡片状态为 completed 并写入 output
    setMessages((prev) => updateToolResultInLastMessage(prev, toolResult));
  }
);
```

---

## 9. 建议的实施顺序与验证方式

| 次序 | 修改内容 | 对应文件路径 | 成功验证标志 |
| --- | --- | --- | --- |
| 1 | 升级后端事件结构 | `AgentStreamEvent.java` | `ToolCall` 和 `ToolResult` 支持携带 Map 格式 payload。 |
| 2 | 解析 AgentScope 入参 | `AgentService.java` | 控制台日志打印出 `发起工具调用，工具: [custom_bash], 指令: [pmset -g batt]`。 |
| 3 | 前端 SSE 协议解析 | `src/services/api.ts` | 浏览器 Console 能够精准收到 `tool_call` JSON 对象。 |
| 4 | 编写 Terminal 卡片组件 | `src/components/chat/CommandCard.tsx` | 独创 Terminal macOS 风格控制台样式呈现。 |
| 5 | 集成到 UI 消息面板 | `src/App.tsx` | 提问“查看系统电池”时，前台跳出极具视觉冲击力的 `$ bash pmset -g batt` 卡片并实时显示结果！ |

---

## 10. 最终代码职责表

| 模块/文件 | 归属 | 核心职责 |
| --- | --- | --- |
| `AgentStreamEvent.java` | 后端 | 定义带命令行与日志 Payload 的 SSE 传输标准。 |
| `AgentService.java` | 后端 | 拦截 AgentScope `ToolCallStartEvent` 提取参数，抛出标准事件。 |
| `api.ts` | 前端 | SSE 细粒度解析器，分派 `text` / `tool_call` / `tool_result` 给 UI。 |
| `CommandCard.tsx` | 前端 | macOS Terminal 极简黑客风格卡片，展示状态动画与交互式控制台输出。 |
