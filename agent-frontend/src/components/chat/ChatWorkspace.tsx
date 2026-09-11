import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage, SessionPermissionMode, TokenUsageSummary } from '../../types/chat';
import type { TaskDto } from '../../types/team';
import { LoadingTree } from '../common/LoadingTree';
import { PermissionRequestCard } from './PermissionRequestCard';
import { PlanApprovalCard } from './PlanApprovalCard';
import { AgentResponse } from './AgentResponse';
import { TokenUsageTrigger } from './TokenUsageTrigger';
import { TokenUsagePanel, type TokenUsageTurnOption } from './TokenUsagePanel';
import { formatTokenCount } from './tokenUsageFormat';
import { ChatStepRail, type StepRailChapter } from './ChatStepRail';
import { MarkdownContent } from '../common/MarkdownContent';
import { SessionOverview, type SessionOverviewProps } from './overview/SessionOverview';
import { PromptInput } from './PromptInput';
import { SubagentActivity } from './SubagentActivity';
import { SubagentTaskPanel } from './SubagentTaskPanel';
import { ProjectFileTree } from './ProjectFileTree';
import { RightSidePanel, type RightPanelTab } from './RightSidePanel';
import { SlashCommandMenu } from './SlashCommandMenu';
import { SlashCommandResult, type SlashCommandResultData } from './SlashCommandResult';
import type { PermissionToolPayload } from '../../services/api';
import { useMessage } from '../common/Message';
import { useModel } from '../../context/ModelContext';
import {
  findSlashCommand,
  parseSlashCommand,
  SLASH_COMMANDS,
  suggestSlashCommands,
  type SlashCommandDefinition,
} from '../../features/slash-command/slashCommands';
import {
  Copy,
  ThumbsUp,
  ThumbsDown,
  Maximize2,
  Bot,
  FolderTree,
  MessageSquare,
  PanelRight,
  ChartNoAxesColumnIncreasing,
} from 'lucide-react';
import styles from './ChatWorkspace.module.css';

interface ChatWorkspaceProps {
  onOpenFeature: SessionOverviewProps['onOpenFeature'];
  onOpenRecords: SessionOverviewProps['onOpenRecords'];
  messages: ChatMessage[];
  sessionId: string;
  sessionTitle?: string;
  sessionUsageSummary?: TokenUsageSummary;
  isSessionLoading?: boolean;
  sessionLoadError?: string | null;
  onRetrySessionLoad?: () => void;
  onSendMessage: (prompt: string) => void;
  onOpenSettings: () => void;
  onRenameSession: (title: string) => Promise<{ success: boolean; message?: string }>;
  pendingPermission?: { assistantMessageId: string; tool: PermissionToolPayload } | null;
  isPermissionSubmitting?: boolean;
  onPermissionDecision?: (approved: boolean, rememberForSession: boolean) => void;
  subagentTasks: TaskDto[];
  isSubagentTasksLoading: boolean;
  subagentTaskError: string | null;
  cancellingTaskId: string | null;
  onRefreshSubagentTasks: () => void;
  onCancelSubagentTask: (taskId: string) => void;
  /** 项目级聊天的项目根目录（非项目聊天为 null）。 */
  projectPath?: string | null;
  permissionMode: SessionPermissionMode;
  onPermissionModeChange: (mode: SessionPermissionMode) => void;
  isPermissionModeDisabled?: boolean;
  isPermissionModeSaving?: boolean;
}

interface AssistantMessageItemProps {
  msg: ChatMessage;
  tokenUsageActive: boolean;
  onOpenTokenUsage: (messageId: string) => void;
}

const AssistantMessageItem: React.FC<AssistantMessageItemProps> = ({
  msg,
  tokenUsageActive,
  onOpenTokenUsage,
}) => {
  const isGenerating = msg.status === undefined && msg.elapsedTime === undefined;
  const elapsedSec = msg.elapsedTime !== undefined
    ? msg.elapsedTime
    : (isGenerating && (msg.startTime || msg.createdAt)
      ? Math.max(1, Math.floor((Date.now() - (msg.startTime || msg.createdAt)) / 1000))
      : undefined);

  const handleCopy = () => {
    if (msg.content) {
      navigator.clipboard.writeText(msg.content);
    }
  };

  return (
    <div className={styles.assistantMessage}>
      {/* Agent 响应过程区：思考 + 工具/终端时间线 */}
      <AgentResponse
        msg={msg}
        isGenerating={isGenerating}
        elapsedSeconds={elapsedSec}
      />

      <SubagentActivity progress={msg.subagentProgress || []} />

      {/* 最终回答正文 */}
      {msg.content?.startsWith('## 验收报告') ? (
        <article className={styles.acceptanceReport}>
          <MarkdownContent content={msg.content} />
        </article>
      ) : (
        msg.content && <MarkdownContent content={msg.content} />
      )}

      {(msg.content || msg.usage) && (
        <div className={styles.messageFooter}>
          {/* 消息底部操作工具栏：复制、赞、踩、全屏/分享 */}
          {msg.content && (
            <div className={styles.messageActions}>
              <button className={styles.actionBtn} title="复制内容" aria-label="复制内容" onClick={handleCopy}>
                <Copy size={14} />
              </button>
              <button className={styles.actionBtn} title="即将推出" aria-label="赞（即将推出）" disabled>
                <ThumbsUp size={14} />
              </button>
              <button className={styles.actionBtn} title="即将推出" aria-label="踩（即将推出）" disabled>
                <ThumbsDown size={14} />
              </button>
              <button className={styles.actionBtn} title="即将推出" aria-label="全屏/扩展（即将推出）" disabled>
                <Maximize2 size={14} />
              </button>
            </div>
          )}
          <TokenUsageTrigger
            usage={msg.usage}
            active={tokenUsageActive}
            onOpen={() => onOpenTokenUsage(msg.id)}
          />
        </div>
      )}
    </div>
  );
};

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  messages,
  onOpenFeature,
  onOpenRecords,
  sessionId,
  sessionTitle = '新对话',
  sessionUsageSummary,
  isSessionLoading = false,
  sessionLoadError = null,
  onRetrySessionLoad,
  onSendMessage,
  onOpenSettings,
  onRenameSession,
  pendingPermission = null,
  isPermissionSubmitting = false,
  onPermissionDecision,
  subagentTasks,
  isSubagentTasksLoading,
  subagentTaskError,
  cancellingTaskId,
  onRefreshSubagentTasks,
  onCancelSubagentTask,
  projectPath = null,
  permissionMode,
  onPermissionModeChange,
  isPermissionModeDisabled = false,
  isPermissionModeSaving = false,
}) => {
  const { showMessage } = useMessage();
  const { getActiveModel, getActiveProvider } = useModel();
  const [inputPrompt, setInputPrompt] = useState('');
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);
  const [commandMenuDismissed, setCommandMenuDismissed] = useState(false);
  const [commandResult, setCommandResult] = useState<SlashCommandResultData | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [rightPanelTabs, setRightPanelTabs] = useState<string[]>([]);
  const [rightPanelTab, setRightPanelTab] = useState<string | null>(null);
  const [tokenUsageMessageId, setTokenUsageMessageId] = useState<string | null>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const commandSuggestions = useMemo(
    () => commandMenuDismissed ? [] : suggestSlashCommands(inputPrompt),
    [commandMenuDismissed, inputPrompt],
  );

  useEffect(() => {
    setCommandSelectedIndex((index) => Math.min(index, Math.max(0, commandSuggestions.length - 1)));
  }, [commandSuggestions.length]);

  const tokenUsageTurns = useMemo<TokenUsageTurnOption[]>(() => {
    const turns: TokenUsageTurnOption[] = [];

    messages.forEach((message) => {
      if (message.role !== 'assistant' || !message.usage) return;
      turns.push({
        messageId: message.id,
        usage: message.usage,
      });
    });

    return turns;
  }, [messages]);

  const availablePanelTabs = useMemo<RightPanelTab[]>(() => {
    const tabs: RightPanelTab[] = [{
      id: 'tasks',
      label: '任务',
      icon: Bot,
    }, {
      id: 'tokens',
      label: 'Token',
      icon: ChartNoAxesColumnIncreasing,
    }];
    if (projectPath) {
      tabs.push({
        id: 'files',
        label: '文件',
        icon: FolderTree,
      });
    }
    return tabs;
  }, [projectPath]);

  const openedPanelTabs = availablePanelTabs.filter((tab) => rightPanelTabs.includes(tab.id));

  // 切换到非项目聊天时关闭不再可用的“文件”标签。
  useEffect(() => {
    if (!projectPath) {
      setRightPanelTabs((tabs) => tabs.filter((tabId) => tabId !== 'files'));
      setRightPanelTab((activeTab) => activeTab === 'files' ? null : activeTab);
    }
  }, [projectPath]);

  // 切换会话或消息失效后，回到整个会话的 Token 视图。
  useEffect(() => {
    if (tokenUsageMessageId && !tokenUsageTurns.some((turn) => turn.messageId === tokenUsageMessageId)) {
      setTokenUsageMessageId(null);
    }
  }, [tokenUsageMessageId, tokenUsageTurns]);

  useEffect(() => {
    const togglePanel = (event: KeyboardEvent) => {
      if (event.altKey && event.metaKey && event.code === 'KeyB') {
        event.preventDefault();
        setRightPanelOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', togglePanel);
    return () => window.removeEventListener('keydown', togglePanel);
  }, []);

  const openPanelTab = (tabId: string) => {
    if (!availablePanelTabs.some((tab) => tab.id === tabId)) return;
    if (tabId === 'tokens') setTokenUsageMessageId(null);
    setRightPanelTabs((tabs) => tabs.includes(tabId) ? tabs : [...tabs, tabId]);
    setRightPanelTab(tabId);
    setRightPanelOpen(true);
  };

  const changePanelTab = (tabId: string) => {
    if (tabId === 'tokens') setTokenUsageMessageId(null);
    setRightPanelTab(tabId);
  };

  const closePanelTab = (tabId: string) => {
    const closedIndex = rightPanelTabs.indexOf(tabId);
    const nextTabs = rightPanelTabs.filter((openTabId) => openTabId !== tabId);
    setRightPanelTabs(nextTabs);
    if (rightPanelTab === tabId) {
      const nextTab = nextTabs[closedIndex] ?? nextTabs[closedIndex - 1] ?? null;
      if (nextTab === 'tokens') setTokenUsageMessageId(null);
      setRightPanelTab(nextTab);
    }
    if (tabId === 'tokens') setTokenUsageMessageId(null);
  };

  const openTokenUsage = (messageId: string) => {
    setTokenUsageMessageId(messageId);
    setRightPanelTabs((tabs) => tabs.includes('tokens') ? tabs : [...tabs, 'tokens']);
    setRightPanelTab('tokens');
    setRightPanelOpen(true);
  };

  const openSessionTokenUsage = () => {
    setTokenUsageMessageId(null);
    setRightPanelTabs((tabs) => tabs.includes('tokens') ? tabs : [...tabs, 'tokens']);
    setRightPanelTab('tokens');
    setRightPanelOpen(true);
  };

  useEffect(() => {
    const area = messagesAreaRef.current;
    if (!area || messages.length === 0) return;
    requestAnimationFrame(() => area.scrollTo({ top: area.scrollHeight, behavior: 'smooth' }));
  }, [messages, pendingPermission]);

  const handleInputValueChange = (value: string) => {
    setInputPrompt(value);
    setCommandMenuDismissed(false);
    setCommandSelectedIndex(0);
  };

  const executeSlashCommand = async (rawInput: string) => {
    const parsed = parseSlashCommand(rawInput);
    if (!parsed) {
      onSendMessage(rawInput.startsWith('//') ? rawInput.slice(1) : rawInput);
      return;
    }
    if (!parsed.name) {
      setCommandResult({ kind: 'help', commands: SLASH_COMMANDS });
      return;
    }

    const command = findSlashCommand(parsed.name);
    if (!command) {
      setCommandResult({ kind: 'error', message: `未知命令：/${parsed.name}。输入 /help 查看可用命令。` });
      return;
    }
    if (command.requiresArgs && !parsed.args) {
      setCommandResult({ kind: 'error', message: `缺少参数。用法：${command.usage}` });
      return;
    }

    if (command.name === 'help') {
      const targetName = parsed.args.replace(/^\//, '').trim();
      const target = targetName ? findSlashCommand(targetName) : undefined;
      if (targetName && !target) {
        setCommandResult({ kind: 'error', message: `没有找到命令：/${targetName}` });
      } else {
        setCommandResult({ kind: 'help', commands: SLASH_COMMANDS, command: target });
      }
      return;
    }

    if (command.name === 'rename') {
      const outcome = await onRenameSession(parsed.args);
      if (outcome.success) {
        setCommandResult(null);
        showMessage('success', `会话已重命名为“${parsed.args}”。`);
      } else {
        setCommandResult({ kind: 'error', message: outcome.message || '会话名称修改失败，请重试。' });
      }
      return;
    }

    if (command.name === 'tokens') {
      setCommandResult(null);
      openSessionTokenUsage();
      return;
    }

    const activeModel = getActiveModel();
    const activeProvider = getActiveProvider();
    const latestUsage = [...messages].reverse().find((message) => message.role === 'assistant' && message.usage)?.usage;
    const latestCall = latestUsage?.calls.at(-1);
    setCommandResult({
      kind: 'status',
      data: {
        sessionId,
        sessionTitle,
        providerName: activeProvider?.name || activeProvider?.id || '未配置',
        modelName: activeModel?.name || activeModel?.id || '未配置',
        permissionMode: permissionMode === 'ASK' ? '逐次询问' : permissionMode === 'AUTO_EDIT' ? '自动编辑' : '完全访问',
        totalTokens: sessionUsageSummary?.totalTokens ?? 0,
        contextTokens: latestCall?.inputTokens ?? latestCall?.estimatedInputTokens,
        contextWindow: activeModel?.contextWindow,
      },
    });
  };

  const selectCommand = (command: SlashCommandDefinition) => {
    if (command.requiresArgs) {
      setInputPrompt(`/${command.name} `);
      setCommandMenuDismissed(true);
      return;
    }
    setInputPrompt('');
    setCommandMenuDismissed(true);
    void executeSlashCommand(`/${command.name}`);
  };

  const handleCommandKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (commandSuggestions.length === 0) return false;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      setCommandSelectedIndex((index) =>
        (index + offset + commandSuggestions.length) % commandSuggestions.length);
      return true;
    }
    if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
      event.preventDefault();
      const selected = commandSuggestions[commandSelectedIndex];
      if (selected) selectCommand(selected);
      return true;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setCommandMenuDismissed(true);
      return true;
    }
    return false;
  };

  const handleSend = () => {
    if (!inputPrompt.trim()) return;
    const prompt = inputPrompt.trim();
    setInputPrompt('');
    setCommandMenuDismissed(false);
    void executeSlashCommand(prompt);
  };

  // 点击左侧任务步骤时间轨：滚动定位到对应消息行
  const handleRailSelect = (chapter: StepRailChapter) => {
    if (!chapter.messageId) return;
    const area = messagesAreaRef.current;
    if (!area) return;
    const row = Array.from(area.querySelectorAll<HTMLElement>('[data-msg-id]')).find(
      (el) => el.dataset.msgId === chapter.messageId
    );
    row?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const isOverview = messages.length === 0;

  const inputArea = pendingPermission && onPermissionDecision ? (
    <div className={`${styles.permissionContainer} ${isOverview ? styles.bottomContainerOverview : ''}`}>
      {pendingPermission.tool.toolName === 'plan_exit' ? (
        <PlanApprovalCard
          sessionId={sessionId}
          isSubmitting={isPermissionSubmitting}
          onDecision={onPermissionDecision}
        />
      ) : (
        <PermissionRequestCard
          tool={pendingPermission.tool}
          isSubmitting={isPermissionSubmitting}
          onDecision={onPermissionDecision}
        />
      )}
    </div>
  ) : (
    <div className={`${styles.bottomContainer} ${isOverview ? styles.bottomContainerOverview : ''}`}>
      {commandSuggestions.length > 0 ? (
        <SlashCommandMenu
          commands={commandSuggestions}
          selectedIndex={commandSelectedIndex}
          onSelect={selectCommand}
        />
      ) : commandResult ? (
        <SlashCommandResult result={commandResult} onClose={() => setCommandResult(null)} />
      ) : null}
      <PromptInput
        value={inputPrompt}
        onValueChange={handleInputValueChange}
        onSend={handleSend}
        onOpenSettings={onOpenSettings}
        permissionMode={permissionMode}
        onPermissionModeChange={onPermissionModeChange}
        isPermissionModeDisabled={isPermissionModeDisabled}
        isPermissionModeSaving={isPermissionModeSaving}
        onInputKeyDown={handleCommandKeyDown}
        commandMenuOpen={commandSuggestions.length > 0}
      />
    </div>
  );

  return (
    <div className={styles.workspace}>
      {/* 顶部工作区：当前会话信息与右侧面板开关 */}
      <div className={styles.workspaceHeader}>
        <div className={styles.workspaceIdentity}>
          {projectPath ? (
            <FolderTree size={16} aria-hidden="true" />
          ) : (
            <MessageSquare size={16} aria-hidden="true" />
          )}
          <span className={styles.workspaceTitle} title={sessionTitle || '新对话'}>
            {sessionTitle || '新对话'}
          </span>
          {sessionUsageSummary && sessionUsageSummary.reportedCallCount > 0 && (
            <button
              type="button"
              className={styles.sessionUsage}
              title={sessionUsageSummary.status === 'PARTIAL'
                ? '查看会话 Token 用量；部分历史轮次或调用尚未统计'
                : '查看当前会话 Token 用量'}
              aria-label="在右侧面板查看当前会话 Token 用量"
              onClick={openSessionTokenUsage}
            >
              {formatTokenCount(sessionUsageSummary.totalTokens)} tokens
              {sessionUsageSummary.status === 'PARTIAL' ? ' · 部分' : ''}
            </button>
          )}
        </div>
        <button
          type="button"
          className={`${styles.panelToggle} ${rightPanelOpen ? styles.panelToggleActive : ''}`}
          onClick={() => setRightPanelOpen((open) => !open)}
          aria-expanded={rightPanelOpen}
          aria-label={rightPanelOpen ? '收起右侧面板' : '展开右侧面板'}
          aria-keyshortcuts="Alt+Meta+B"
          title={`${rightPanelOpen ? '隐藏' : '显示'}侧边面板（⌥⌘B）`}
        >
          <PanelRight size={17} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.workspaceBody}>
        {/* Hero Empty State OR Chat Messages */}
        {sessionLoadError ? (
          <div className={styles.sessionLoadState} role="alert">
            <p>{sessionLoadError}</p>
            {onRetrySessionLoad && (
              <button type="button" className={styles.retryLoadBtn} onClick={onRetrySessionLoad}>
                重新加载
              </button>
            )}
          </div>
        ) : isSessionLoading ? (
          <div className={styles.sessionLoadState}>
            <LoadingTree size="large" label="正在读取聊天记录…" />
          </div>
        ) : (
          <div className={styles.chatBody}>
            {/* Codex 风格任务步骤时间轨 */}
            {messages.length > 0 && <div className={styles.railColumn}>
              <ChatStepRail messages={messages} onSelect={handleRailSelect} />
            </div>}

            <div className={`${styles.chatColumn} ${isOverview ? styles.chatColumnOverview : ''}`}>
              <div
                ref={messagesAreaRef}
                className={`${styles.messagesArea} ${isOverview ? styles.overviewArea : ''}`}
              >
                {messages.length === 0 && <SessionOverview key={sessionId} onOpenFeature={onOpenFeature} onOpenRecords={onOpenRecords} onCompose={(prompt) => {
                  setInputPrompt(prompt);
                  messagesAreaRef.current?.parentElement?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
                }} />}
                {messages.length > 0 && (
                  <div className={styles.messagesInner}>
                    {messages.map((msg) => (
                      <div key={msg.id} data-msg-id={msg.id} className={styles.messageRow}>
                        {msg.role === 'user' ? (
                          <div className={styles.userMessage}>{msg.content}</div>
                        ) : (
                          <AssistantMessageItem
                            msg={msg}
                            tokenUsageActive={rightPanelOpen && rightPanelTab === 'tokens' && tokenUsageMessageId === msg.id}
                            onOpenTokenUsage={openTokenUsage}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {inputArea}
            </div>
          </div>
        )}

        <RightSidePanel
          open={rightPanelOpen}
          availableTabs={availablePanelTabs}
          tabs={openedPanelTabs}
          activeTab={rightPanelTab}
          onTabChange={changePanelTab}
          onOpenTab={openPanelTab}
          onCloseTab={closePanelTab}
        >
          {rightPanelTab === 'tasks' ? (
            <SubagentTaskPanel
              tasks={subagentTasks}
              isLoading={isSubagentTasksLoading}
              error={subagentTaskError}
              cancellingTaskId={cancellingTaskId}
              onRefresh={onRefreshSubagentTasks}
              onCancel={onCancelSubagentTask}
            />
          ) : rightPanelTab === 'tokens' ? (
            <TokenUsagePanel
              turns={tokenUsageTurns}
              sessionUsageSummary={sessionUsageSummary}
              selectedMessageId={tokenUsageMessageId}
            />
          ) : projectPath ? (
            <ProjectFileTree projectPath={projectPath} />
          ) : null}
        </RightSidePanel>
      </div>
    </div>
  );
};

export default ChatWorkspace;
