import React, { useMemo } from 'react';
import { Database, FileCode2, FileText, Search, Terminal } from 'lucide-react';
import type { ChatMessage, ToolDefinition, TraceNode, ToolExecution } from '../../types/chat';
import { ThinkingState } from './ThinkingState';
import styles from './AgentResponse.module.css';

/** 默认工具展示注册表 */
export const DEFAULT_TOOL_REGISTRY: Record<string, ToolDefinition> = {
  read_file: {
    name: 'read_file',
    label: '读取',
    icon: FileText,
    monoChip: true,
  },
  edit_file: {
    name: 'edit_file',
    label: '编辑',
    icon: FileCode2,
    iconClassName: '#d97706',
    monoChip: true,
  },
  execute_command: {
    name: 'execute_command',
    label: '运行',
    icon: Terminal,
    iconClassName: '#7c3aed',
    monoChip: true,
  },
  search_web: {
    name: 'search_web',
    label: '搜索',
    icon: Search,
  },
  query_database: {
    name: 'query_database',
    label: 'SQL 查询',
    icon: Database,
    iconClassName: '#059669',
    monoChip: true,
  },
};

/**
 * 将流式思考文本拆分为句子；流式未结束时丢弃未完结的半句。
 */
function splitSentences(text: string, includePartial: boolean): string[] {
  const clean = text.trim().replace(/\s*\n\s*/g, ' ');
  if (!clean) return [];
  const parts = clean.split(/(?<=[。！？!?；;])\s*/).filter(Boolean);
  if (!includePartial && parts.length > 0) {
    const last = parts[parts.length - 1];
    if (!/[。！？!?；;]$/.test(last)) {
      parts.pop();
    }
  }
  return parts;
}

function toTraceNodes(
  reasoning: string | undefined,
  tools: ToolExecution[] | undefined,
  elapsedSeconds: number | undefined,
  isGenerating: boolean
): TraceNode[] {
  const nodes: TraceNode[] = [];

  if (reasoning && reasoning.trim()) {
    nodes.push({
      type: 'reasoning',
      sentences: splitSentences(reasoning, !isGenerating),
      durationSeconds: elapsedSeconds,
    });
  }

  (tools || []).forEach((tool) => {
    const running = tool.status === 'running';
    const failed = tool.status === 'failed';
    const status = running ? 'running' : failed ? 'failed' : 'completed';
    // 仅按真实工具名判断是否为终端命令执行，避免把参数 JSON 误判为命令
    const isCommand =
      tool.toolName === 'execute_command' ||
      tool.toolName === 'execute' ||
      tool.toolName === 'terminal';
    const toolDef = DEFAULT_TOOL_REGISTRY[tool.toolName];
    const toolLabel = typeof toolDef?.label === 'function' ? toolDef.label(undefined) : toolDef?.label;

    if (isCommand) {
      nodes.push({
        id: tool.toolCallId,
        type: 'terminal',
        toolName: tool.toolName,
        primary: '运行',
        secondary: tool.command,
        command: tool.command,
        output: tool.output,
        exitCode: failed ? 1 : 0,
        status,
      });
      return;
    }

    nodes.push({
      id: tool.toolCallId,
      type: 'tool',
      toolName: tool.toolName,
      primary: toolLabel || tool.toolName,
      secondary: tool.command || tool.toolName,
      command: tool.command,
      status,
      details: tool.output
        ? tool.output
            .split('\n')
            .filter(Boolean)
            .map((text) => ({ text, tone: 'muted' as const }))
        : undefined,
    });
  });

  return nodes;
}

export interface AgentResponseProps {
  msg: ChatMessage;
  isGenerating: boolean;
  elapsedSeconds?: number;
}

/**
 * Agent 响应过程区：由 ChatMessage 构建时间线（思考 + 工具/终端），
 * 并以“工作中 → 共耗时 N 秒”的折叠态呈现。
 */
export const AgentResponse: React.FC<AgentResponseProps> = ({
  msg,
  isGenerating,
  elapsedSeconds,
}) => {
  const trace = useMemo(
    () => toTraceNodes(msg.reasoning, msg.tools, elapsedSeconds, isGenerating),
    [msg.reasoning, msg.tools, elapsedSeconds, isGenerating]
  );

  if (!isGenerating && trace.length === 0) return null;

  return (
    <div className={styles.container}>
      <ThinkingState
        nodes={trace}
        tools={DEFAULT_TOOL_REGISTRY}
        isWorking={isGenerating}
        elapsedSeconds={elapsedSeconds}
        workingLabel="正在处理"
      />
    </div>
  );
};
