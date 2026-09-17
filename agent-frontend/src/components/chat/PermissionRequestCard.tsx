import { useEffect, useMemo, useState } from 'react';
import { ShieldAlert, Check, ChevronDown, X } from 'lucide-react';
import type { PermissionDecisionInput, PermissionToolPayload } from '../../services/api';
import styles from './PermissionRequestCard.module.css';

interface PermissionRequestCardProps {
  tools: PermissionToolPayload[];
  isSubmitting: boolean;
  onDecision: (decisions: PermissionDecisionInput[]) => void;
}

type Decision = 'allow' | 'deny';

function summarizeInput(input: Record<string, unknown>): string {
  const preferredKeys = ['command', 'path', 'url', 'query', 'name'];
  const key = preferredKeys.find((candidate) => typeof input[candidate] === 'string');
  if (key) return String(input[key]);
  const firstValue = Object.values(input).find((value) => typeof value === 'string');
  return firstValue ? String(firstValue) : '查看完整参数';
}

/** 在一张卡片中展示并审核同一批次的高风险工具调用。 */
export function PermissionRequestCard({
  tools,
  isSubmitting,
  onDecision,
}: PermissionRequestCardProps) {
  const [rememberForSession, setRememberForSession] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const decidedCount = Object.keys(decisions).length;
  const allDecided = decidedCount === tools.length;

  useEffect(() => {
    setDecisions({});
    setRememberForSession(false);
  }, [tools]);

  const toolIds = useMemo(() => tools.map((tool) => tool.toolCallId), [tools]);

  const chooseAll = (decision: Decision) => {
    setDecisions(Object.fromEntries(toolIds.map((toolCallId) => [toolCallId, decision])));
  };

  const submit = () => {
    if (!allDecided) return;
    onDecision(tools.map((tool) => ({
      toolCallId: tool.toolCallId,
      approved: decisions[tool.toolCallId] === 'allow',
      rememberForSession,
    })));
  };

  return (
    <section className={styles.card} aria-label="工具权限确认">
      <div className={styles.heading}>
        <ShieldAlert size={18} aria-hidden="true" />
        <div>
          <p className={styles.title}>需要确认 {tools.length} 项操作</p>
          <p className={styles.progress}>逐项核对后统一提交，未允许的操作不会执行</p>
        </div>
      </div>

      <div className={styles.toolList}>
        {tools.map((tool) => (
          <article className={styles.toolItem} key={tool.toolCallId}>
            <div className={styles.toolMain}>
              <div className={styles.toolCopy}>
                <div className={styles.toolTitleRow}>
                  <span className={styles.toolIndex}>{tool.index}</span>
                  <strong>{tool.riskDescription}</strong>
                  <code>{tool.toolName}</code>
                </div>
                <p className={styles.inputSummary} title={summarizeInput(tool.input)}>
                  {summarizeInput(tool.input)}
                </p>
              </div>
              <div className={styles.itemDecision} role="group" aria-label={`${tool.toolName} 的决定`}>
                <button
                  type="button"
                  className={decisions[tool.toolCallId] === 'deny' ? styles.denySelected : styles.choice}
                  aria-pressed={decisions[tool.toolCallId] === 'deny'}
                  disabled={isSubmitting}
                  onClick={() => setDecisions((current) => ({ ...current, [tool.toolCallId]: 'deny' }))}
                >
                  <X size={14} aria-hidden="true" />拒绝
                </button>
                <button
                  type="button"
                  className={decisions[tool.toolCallId] === 'allow' ? styles.allowSelected : styles.choice}
                  aria-pressed={decisions[tool.toolCallId] === 'allow'}
                  disabled={isSubmitting}
                  onClick={() => setDecisions((current) => ({ ...current, [tool.toolCallId]: 'allow' }))}
                >
                  <Check size={14} aria-hidden="true" />允许
                </button>
              </div>
            </div>
            <details className={styles.parameters}>
              <summary><ChevronDown size={13} aria-hidden="true" />查看完整参数</summary>
              <pre>{JSON.stringify(tool.input, null, 2)}</pre>
            </details>
          </article>
        ))}
      </div>

      <div className={styles.footer}>
        <label className={styles.remember}>
          <input
            type="checkbox"
            checked={rememberForSession}
            disabled={isSubmitting}
            onChange={(event) => setRememberForSession(event.target.checked)}
          />
          本会话记住相同操作
        </label>

        <div className={styles.actions}>
          {tools.length > 1 && (
            <>
              <button type="button" className={styles.ghost} disabled={isSubmitting} onClick={() => chooseAll('deny')}>
                全部拒绝
              </button>
              <button type="button" className={styles.ghost} disabled={isSubmitting} onClick={() => chooseAll('allow')}>
                全部允许
              </button>
            </>
          )}
          <button
            type="button"
            className={styles.allow}
            disabled={isSubmitting || !allDecided}
            onClick={submit}
          >
            <Check size={15} aria-hidden="true" />
            {isSubmitting ? '正在提交…' : allDecided ? `提交 ${tools.length} 项决定` : `还需决定 ${tools.length - decidedCount} 项`}
          </button>
        </div>
      </div>
    </section>
  );
}
