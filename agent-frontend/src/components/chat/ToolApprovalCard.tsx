import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { PermissionDecisionInput, PermissionToolPayload } from '../../services/api';
import styles from './ToolApprovalCard.module.css';

export interface ToolApprovalCardProps {
  /** 待审核的工具列表 */
  tools: PermissionToolPayload[];
  /** 是否正在提交请求 */
  isSubmitting: boolean;
  /** 提交审批决定 */
  onDecision: (decisions: PermissionDecisionInput[]) => void;
  /** 可选关闭/取消回调 */
  onCancel?: () => void;
  /** 扩展 class */
  className?: string;
}

type DecisionType = 'allow' | 'deny';

/** 常见工具的中文友好展示名称映射 */
const TOOL_NAME_MAP: Record<string, string> = {
  // 学习记录
  study_create_manual: '创建学习记录',
  study_start: '开始学习时段',
  study_finish: '结束学习时段',
  study_update: '更新学习记录',
  study_delete: '删除学习记录',
  study_query: '查询学习记录',

  // 待办事项
  todo_create: '创建待办事项',
  todo_update: '更新待办事项',
  todo_delete: '删除待办事项',
  todo_query: '查询待办事项',

  // 财务记账
  finance_record_transaction: '记录财务收支',
  finance_delete_transaction: '删除财务收支',

  // 文件与终端
  write_file: '写入本地文件',
  edit_file: '编辑文件内容',
  read_file: '读取本地文件',
  execute: '执行系统命令',
  execute_command: '执行系统命令',
  custom_bash: '运行终端脚本',
  terminal: '终端会话操作',

  // 网络与数据
  http_request: '发送网络请求',
  web_search: '执行网络搜索',
  query_database: '执行 SQL 查询',

  // 任务计划
  plan_exit: '提交任务计划书',
  task_cancel: '取消后台任务',
  session_search: '搜索历史会话',
};

/** 解析工具的风险操作徽章 */
function getRiskBadge(toolName: string, riskDescription?: string): string {
  if (riskDescription) {
    if (riskDescription.includes('写入') || riskDescription.includes('修改数据')) return '写入操作';
    if (riskDescription.includes('Shell') || riskDescription.includes('命令')) return '系统命令';
    if (riskDescription.includes('网络') || riskDescription.includes('请求')) return '网络请求';
    if (riskDescription.includes('文件')) return '文件修改';
  }
  if (toolName.includes('create') || toolName.includes('record')) return '写入操作';
  if (toolName.includes('delete')) return '删除操作';
  if (toolName.includes('update') || toolName.includes('edit') || toolName.includes('write')) return '修改操作';
  if (toolName.includes('execute') || toolName.includes('bash') || toolName.includes('terminal')) return '系统命令';
  if (toolName.includes('http') || toolName.includes('search')) return '网络访问';
  return '高风险操作';
}

/** 格式化参数值输出 */
function formatParamValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * 极简纯白优雅风格的工具审批卡片组件（Minimal White）
 */
export const ToolApprovalCard: React.FC<ToolApprovalCardProps> = ({
  tools,
  isSubmitting,
  onDecision,
  onCancel,
  className,
}) => {
  const [rememberForSession, setRememberForSession] = useState(false);
  // 控制各个工具参数区的展开/折叠状态，单工具默认展开
  const [openParams, setOpenParams] = useState<Record<string, boolean>>(() => {
    if (tools.length === 1) {
      return { [tools[0].toolCallId]: true };
    }
    return {};
  });

  // 多工具时逐项决定的状态
  const [decisions, setDecisions] = useState<Record<string, DecisionType>>(() =>
    Object.fromEntries(tools.map((t) => [t.toolCallId, 'allow']))
  );

  useEffect(() => {
    setRememberForSession(false);
    setOpenParams(tools.length === 1 ? { [tools[0].toolCallId]: true } : {});
    setDecisions(Object.fromEntries(tools.map((t) => [t.toolCallId, 'allow'])));
  }, [tools]);

  const isSingleTool = tools.length === 1;
  const singleTool = tools[0];

  // 切换折叠参数
  const toggleParamOpen = (toolCallId: string) => {
    setOpenParams((prev) => ({
      ...prev,
      [toolCallId]: !prev[toolCallId],
    }));
  };

  // 提交允许
  const handleAllow = useCallback(() => {
    if (isSubmitting) return;
    if (isSingleTool) {
      onDecision([
        {
          toolCallId: singleTool.toolCallId,
          approved: true,
          rememberForSession,
        },
      ]);
    } else {
      // 多工具：提交当前所选项
      onDecision(
        tools.map((tool) => ({
          toolCallId: tool.toolCallId,
          approved: decisions[tool.toolCallId] === 'allow',
          rememberForSession,
        }))
      );
    }
  }, [isSubmitting, isSingleTool, singleTool, onDecision, rememberForSession, tools, decisions]);

  // 提交拒绝
  const handleDeny = useCallback(() => {
    if (isSubmitting) return;
    if (onCancel) {
      onCancel();
    }
    onDecision(
      tools.map((tool) => ({
        toolCallId: tool.toolCallId,
        approved: false,
        rememberForSession,
      }))
    );
  }, [isSubmitting, onCancel, onDecision, tools, rememberForSession]);

  // 全部允许
  const handleAllowAll = () => {
    if (isSubmitting) return;
    onDecision(
      tools.map((tool) => ({
        toolCallId: tool.toolCallId,
        approved: true,
        rememberForSession,
      }))
    );
  };

  // 全部拒绝
  const handleDenyAll = () => {
    if (isSubmitting) return;
    onDecision(
      tools.map((tool) => ({
        toolCallId: tool.toolCallId,
        approved: false,
        rememberForSession,
      }))
    );
  };

  // 键盘快捷键监听：Esc 拒绝，Enter 允许
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isSubmitting) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') &&
        target.getAttribute('type') !== 'checkbox'
      ) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        handleDeny();
      } else if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        handleAllow();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, handleDeny, handleAllow]);

  // 标题文案
  const title = useMemo(() => {
    return isSingleTool ? '确认执行此操作？' : `确认执行这 ${tools.length} 项操作？`;
  }, [isSingleTool, tools.length]);

  // 描述文案
  const description = useMemo(() => {
    if (isSingleTool && singleTool) {
      if (singleTool.riskDescription) {
        if (singleTool.riskDescription.startsWith('将') || singleTool.riskDescription.startsWith('该')) {
          return `${singleTool.riskDescription}。执行前请确认工具与参数是否符合你的预期。`;
        }
        return `该工具${singleTool.riskDescription}。执行前请确认工具与参数是否符合你的预期。`;
      }
      const displayName = TOOL_NAME_MAP[singleTool.toolName] || singleTool.toolName;
      return `该工具会${displayName}。执行前请确认工具与参数是否符合你的预期。`;
    }
    return `当前批次包含 ${tools.length} 个工具操作。逐项核对或批量确认后统一提交，未允许的操作不会执行。`;
  }, [isSingleTool, singleTool, tools.length]);

  return (
    <section
      className={`${styles.card} ${className || ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="approvalTitle"
    >
      {/* 顶部标题与关闭按钮 */}
      <div className={styles.top}>
        <div className={styles.heading}>
          <div className={styles.eyebrow}>Approval required</div>
          <h1 className={styles.title} id="approvalTitle">
            {title}
          </h1>
          <p className={styles.desc}>{description}</p>
        </div>

        <button
          className={styles.close}
          type="button"
          aria-label="关闭"
          disabled={isSubmitting}
          onClick={handleDeny}
          title="关闭 / 拒绝"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M7 7l10 10M17 7 7 17" />
          </svg>
        </button>
      </div>

      {/* 工具列表 */}
      <div className={styles.toolList}>
        {tools.map((tool) => {
          const toolName = tool.toolName;
          const displayName = TOOL_NAME_MAP[toolName] || toolName;
          const riskBadge = getRiskBadge(toolName, tool.riskDescription);
          const inputEntries = Object.entries(tool.input || {});
          const isOpen = Boolean(openParams[tool.toolCallId]);
          const currentDecision = decisions[tool.toolCallId] || 'allow';

          return (
            <div className={styles.tool} key={tool.toolCallId}>
              {/* 工具头部：名称、ID、风险徽章 */}
              <div className={styles.toolTop}>
                <div className={styles.toolCopy}>
                  <div className={styles.toolLabel}>Tool</div>
                  <div className={styles.toolMain}>
                    <span className={styles.toolName}>{displayName}</span>
                    <span className={styles.toolId}>{toolName}</span>
                  </div>
                </div>

                <div className={styles.toolHeaderRight}>
                  <div className={styles.risk}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 4 20 19H4L12 4Z" />
                      <path d="M12 9v4M12 16.5h.01" />
                    </svg>
                    {riskBadge}
                  </div>

                  {!isSingleTool && (
                    <div className={styles.itemDecision} role="group" aria-label={`${displayName} 的决定`}>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        className={`${styles.itemBtn} ${currentDecision === 'deny' ? styles.itemDenyActive : ''}`}
                        onClick={() =>
                          setDecisions((prev) => ({
                            ...prev,
                            [tool.toolCallId]: 'deny',
                          }))
                        }
                      >
                        拒绝
                      </button>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        className={`${styles.itemBtn} ${currentDecision === 'allow' ? styles.itemAllowActive : ''}`}
                        onClick={() =>
                          setDecisions((prev) => ({
                            ...prev,
                            [tool.toolCallId]: 'allow',
                          }))
                        }
                      >
                        允许
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 参数列表折叠/展开 */}
              <div className={styles.params}>
                <button
                  className={styles.paramsToggle}
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => toggleParamOpen(tool.toolCallId)}
                >
                  <span className={styles.paramsToggleLeft}>
                    <svg
                      className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="m7 9 5 5 5-5" />
                    </svg>
                    {isOpen ? '收起参数' : '查看完整参数'}
                  </span>

                  <span className={styles.count}>{inputEntries.length} 项</span>
                </button>

                {isOpen && (
                  <div className={styles.paramsBody}>
                    {inputEntries.length === 0 ? (
                      <div className={styles.paramEmpty}>无传入参数</div>
                    ) : (
                      <div className={styles.paramList}>
                        {inputEntries.map(([key, val]) => (
                          <div className={styles.param} key={key}>
                            <div className={styles.paramKey}>{key}</div>
                            <div className={styles.paramValue}>{formatParamValue(val)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部记忆与操作按钮 */}
      <div className={styles.bottom}>
        <label className={styles.remember}>
          <input
            type="checkbox"
            checked={rememberForSession}
            disabled={isSubmitting}
            onChange={(e) => setRememberForSession(e.target.checked)}
          />
          <span className={styles.check}>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2">
              <path d="m5 12 4 4 10-10" />
            </svg>
          </span>
          本会话记住相同操作
        </label>

        <div className={styles.actions}>
          {isSingleTool ? (
            <>
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                type="button"
                disabled={isSubmitting}
                onClick={handleDeny}
              >
                拒绝
              </button>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                type="button"
                disabled={isSubmitting}
                onClick={handleAllow}
              >
                {isSubmitting ? '正在提交…' : '允许执行'}
              </button>
            </>
          ) : (
            <>
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                type="button"
                disabled={isSubmitting}
                onClick={handleDenyAll}
              >
                全部拒绝
              </button>
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                type="button"
                disabled={isSubmitting}
                onClick={handleAllowAll}
              >
                全部允许
              </button>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                type="button"
                disabled={isSubmitting}
                onClick={handleAllow}
              >
                {isSubmitting ? '正在提交…' : `提交 ${tools.length} 项决定`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 底部快捷键提示 */}
      <div className={styles.shortcut}>
        <kbd>Esc</kbd> 拒绝　·　<kbd>Enter</kbd> 允许
      </div>
    </section>
  );
};
