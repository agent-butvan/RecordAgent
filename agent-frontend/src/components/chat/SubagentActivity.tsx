import React, { useMemo, useState } from 'react';
import { Bot, ChevronDown, CircleCheck, Wrench } from 'lucide-react';
import type { SubagentProgressDto } from '../../types/team';
import styles from './SubagentActivity.module.css';

interface AgentProgressSummary {
  source: string;
  agentId: string;
  isComplete: boolean;
  latestText: string;
  latestTool: string;
}

export interface SubagentActivityProps {
  progress: SubagentProgressDto[];
}

function summarizeProgress(progress: SubagentProgressDto[]): AgentProgressSummary[] {
  const agents = new Map<string, AgentProgressSummary>();

  for (const item of progress) {
    const key = item.source || item.agentId;
    const current = agents.get(key) ?? {
      source: item.source,
      agentId: item.agentId || '子 Agent',
      isComplete: false,
      latestText: '',
      latestTool: '',
    };

    if (item.eventType === 'text' && item.content) current.latestText += item.content;
    if (item.eventType === 'tool' && item.content) current.latestTool = item.content;
    if (item.eventType === 'end') current.isComplete = true;
    if (item.eventType === 'start') current.isComplete = false;
    agents.set(key, current);
  }

  return [...agents.values()];
}

/** 在主 Agent 回复中按来源汇总展示同步子 Agent 的执行进度。 */
export const SubagentActivity: React.FC<SubagentActivityProps> = ({ progress }) => {
  const [expanded, setExpanded] = useState(true);
  const agents = useMemo(() => summarizeProgress(progress), [progress]);
  const activeCount = agents.filter((agent) => !agent.isComplete).length;

  if (agents.length === 0) return null;

  return (
    <section className={styles.container} aria-label="子 Agent 执行进度">
      <button
        type="button"
        className={styles.header}
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span className={styles.title}>
          <Bot size={15} aria-hidden="true" />
          {activeCount > 0 ? `${activeCount} 个子 Agent 正在协作` : '子 Agent 协作已完成'}
        </span>
        <ChevronDown
          size={15}
          aria-hidden="true"
          className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}
        />
      </button>

      {expanded && (
        <div className={styles.list}>
          {agents.map((agent) => (
            <div className={styles.agent} key={agent.source || agent.agentId}>
              <div className={styles.agentHeader}>
                <span className={styles.agentName}>{agent.agentId}</span>
                <span className={agent.isComplete ? styles.complete : styles.running}>
                  {agent.isComplete ? (
                    <CircleCheck size={13} aria-hidden="true" />
                  ) : (
                    <span className={styles.pulse} aria-hidden="true" />
                  )}
                  {agent.isComplete ? '已完成' : '执行中'}
                </span>
              </div>
              {agent.latestTool && (
                <div className={styles.tool}>
                  <Wrench size={12} aria-hidden="true" />
                  正在使用 {agent.latestTool}
                </div>
              )}
              {agent.latestText && <p className={styles.content}>{agent.latestText}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
