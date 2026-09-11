import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentAnalysisContextRequest, ChatMessage, SessionPermissionMode, TokenUsageSummary } from '../../types/chat';
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
import { SlashCommandChip } from './SlashCommandChip';
import { RecordReferenceTag } from './RecordReferenceTag';
import { SlashCommandResult, type SlashCommandResultData } from './SlashCommandResult';
import { RecordReferencePicker } from './RecordReferencePicker';
import { RecordReferenceChip } from './RecordReferenceChip';
import { AnalysisPrivacyCard } from './AnalysisPrivacyCard';
import type { PermissionToolPayload } from '../../services/api';
import { fetchRecordReferences } from '../../services/recordApi';
import { fetchDailyInsight } from '../../services/dailyInsightApi';
import { fetchDailyDay } from '../../services/dailyEvents';
import { fetchFinanceExpenseChart } from '../../services/financeApi';
import { fetchStudyStatistics } from '../../services/studyApi';
import type { RecordReferenceOption } from '../../types/record';
import { useMessage } from '../common/Message';
import { useModel } from '../../context/ModelContext';
import {
  asRecordReferenceCommand,
  findSlashCommand,
  parseSlashCommand,
  parseRecordReferencePickerQuery,
  RECORD_REFERENCE_LIMITS,
  SLASH_COMMANDS,
  suggestSlashCommands,
  type RecordReferenceCommandName,
  type SlashCommandDefinition,
} from '../../features/slash-command/slashCommands';
import {
  parseOptionalDateArgument,
  parseQueryPeriod,
  queryPeriodRange,
} from '../../features/slash-command/slashCommandArguments';
import {
  isAnalysisCommand,
  prepareAnalysisCommand,
  type PreparedAnalysisCommand,
} from '../../features/slash-command/analysisCommands';
import { parseSlashCommandDisplayArguments } from '../../features/slash-command/slashCommandDisplay';
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
  isSessionStreaming?: boolean;
  sessionLoadError?: string | null;
  onRetrySessionLoad?: () => void;
  onSendMessage: (
    prompt: string,
    modelContext?: string,
    recordReferenceIds?: string[],
    analysisContext?: AgentAnalysisContextRequest,
  ) => void;
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
  isSessionStreaming = false,
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
  const [selectedCommand, setSelectedCommand] = useState<SlashCommandDefinition | null>(null);
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);
  const [commandMenuDismissed, setCommandMenuDismissed] = useState(false);
  const [commandResult, setCommandResult] = useState<SlashCommandResultData | null>(null);
  const [pendingAnalysis, setPendingAnalysis] = useState<PreparedAnalysisCommand | null>(null);
  const [recordReferences, setRecordReferences] = useState<RecordReferenceOption[]>([]);
  const [recordReferenceIndex, setRecordReferenceIndex] = useState(0);
  const [recordReferenceSelection, setRecordReferenceSelection] = useState<{
    command: RecordReferenceCommandName | null;
    items: RecordReferenceOption[];
  }>({ command: null, items: [] });
  const [recordReferencesLoading, setRecordReferencesLoading] = useState(false);
  const [recordReferencesLoadingMore, setRecordReferencesLoadingMore] = useState(false);
  const [recordReferencesError, setRecordReferencesError] = useState<string | null>(null);
  const [recordReferencesHasMore, setRecordReferencesHasMore] = useState(false);
  const [recordReferencesNextOffset, setRecordReferencesNextOffset] = useState(0);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [rightPanelTabs, setRightPanelTabs] = useState<string[]>([]);
  const [rightPanelTab, setRightPanelTab] = useState<string | null>(null);
  const [tokenUsageMessageId, setTokenUsageMessageId] = useState<string | null>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const recordReferenceQueryRef = useRef<string | null>(null);
  const commandSuggestions = useMemo(
    () => commandMenuDismissed || selectedCommand ? [] : suggestSlashCommands(inputPrompt),
    [commandMenuDismissed, inputPrompt, selectedCommand],
  );
  const composedInputPrompt = selectedCommand
    ? `/${selectedCommand.name}${inputPrompt.trim() ? ` ${inputPrompt.trim()}` : ''}`
    : inputPrompt;
  const activeRecordReferenceCommand = asRecordReferenceCommand(
    selectedCommand?.name ?? parseSlashCommand(inputPrompt)?.name ?? '',
  );
  const selectedRecordReferences = useMemo(
    () => recordReferenceSelection.command === activeRecordReferenceCommand
      ? recordReferenceSelection.items : [],
    [activeRecordReferenceCommand, recordReferenceSelection],
  );
  const selectedReferenceCommand = asRecordReferenceCommand(selectedCommand?.name ?? '');
  const selectedCommandCanSend = Boolean(selectedCommand)
    && (!selectedCommand?.requiresArgs || inputPrompt.trim().length > 0)
    && (!selectedReferenceCommand
      || selectedRecordReferences.length === RECORD_REFERENCE_LIMITS[selectedReferenceCommand]);
  const recordReferenceQuery = useMemo(() => {
    return parseRecordReferencePickerQuery(composedInputPrompt, selectedRecordReferences.length);
  }, [composedInputPrompt, selectedRecordReferences.length]);
  const availableRecordReferences = useMemo(() => {
    const selectedIds = new Set(selectedRecordReferences.map((item) => item.id));
    return recordReferences.filter((item) => !selectedIds.has(item.id));
  }, [recordReferences, selectedRecordReferences]);

  useEffect(() => {
    setCommandSelectedIndex((index) => Math.min(index, Math.max(0, commandSuggestions.length - 1)));
  }, [commandSuggestions.length]);

  useEffect(() => {
    recordReferenceQueryRef.current = recordReferenceQuery;
    if (recordReferenceQuery === null) return;
    let cancelled = false;
    setRecordReferencesLoading(true);
    setRecordReferencesError(null);
    setRecordReferences([]);
    setRecordReferencesHasMore(false);
    setRecordReferencesNextOffset(0);
    setRecordReferencesLoadingMore(false);
    const timer = window.setTimeout(() => {
      fetchRecordReferences(recordReferenceQuery)
        .then((page) => {
          if (cancelled) return;
          setRecordReferences(page.items);
          setRecordReferencesHasMore(page.hasMore);
          setRecordReferencesNextOffset(page.nextOffset);
          setRecordReferenceIndex(0);
        })
        .catch((error) => {
          if (cancelled) return;
          setRecordReferences([]);
          setRecordReferencesHasMore(false);
          setRecordReferencesError(error instanceof Error ? error.message : '资料读取失败，请重试。');
        })
        .finally(() => { if (!cancelled) setRecordReferencesLoading(false); });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [recordReferenceQuery]);

  const loadMoreRecordReferences = async () => {
    if (recordReferenceQuery === null || !recordReferencesHasMore || recordReferencesLoadingMore) return;
    const requestedQuery = recordReferenceQuery;
    setRecordReferencesLoadingMore(true);
    setRecordReferencesError(null);
    try {
      const page = await fetchRecordReferences(recordReferenceQuery, 30, recordReferencesNextOffset);
      if (recordReferenceQueryRef.current !== requestedQuery) return;
      setRecordReferences((current) => {
        const knownIds = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !knownIds.has(item.id))];
      });
      setRecordReferencesHasMore(page.hasMore);
      setRecordReferencesNextOffset(page.nextOffset);
    } catch (error) {
      if (recordReferenceQueryRef.current !== requestedQuery) return;
      setRecordReferencesError(commandError(error, '更多资料加载失败，请重试。'));
    } finally {
      if (recordReferenceQueryRef.current === requestedQuery) setRecordReferencesLoadingMore(false);
    }
  };

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
    if (pendingAnalysis) setPendingAnalysis(null);
    const nextCommand = asRecordReferenceCommand(
      selectedCommand?.name ?? parseSlashCommand(value)?.name ?? '',
    );
    setRecordReferenceSelection((current) => current.command && current.command !== nextCommand
      ? { command: null, items: [] }
      : current);
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

    if (command.name === 'today') {
      setCommandResult({ kind: 'loading', message: '正在汇总今日活动…' });
      try {
        const date = parseOptionalDateArgument(parsed.args);
        setCommandResult({ kind: 'today', data: await fetchDailyInsight(date) });
      } catch (error) {
        setCommandResult({
          kind: 'error',
          message: error instanceof Error ? error.message : '今日活动汇总失败，请重试。',
        });
      }
      return;
    }

    if (command.name === 'agenda') {
      setCommandResult({ kind: 'loading', message: '正在读取待办与日程…' });
      try {
        const date = parseOptionalDateArgument(parsed.args);
        setCommandResult({ kind: 'agenda', data: await fetchDailyDay(new Date(`${date}T12:00:00`)) });
      } catch (error) {
        setCommandResult({ kind: 'error', message: commandError(error, '日程读取失败，请重试。') });
      }
      return;
    }

    if (command.name === 'spending') {
      setCommandResult({ kind: 'loading', message: '正在统计收支情况…' });
      try {
        const period = parseQueryPeriod(parsed.args, 'month');
        setCommandResult({ kind: 'spending', data: await fetchFinanceExpenseChart(period) });
      } catch (error) {
        setCommandResult({ kind: 'error', message: commandError(error, '收支统计失败，请重试。') });
      }
      return;
    }

    if (command.name === 'study-report') {
      setCommandResult({ kind: 'loading', message: '正在统计学习情况…' });
      try {
        const period = parseQueryPeriod(parsed.args, 'week');
        const range = queryPeriodRange(period);
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setCommandResult({
          kind: 'study-report',
          data: await fetchStudyStatistics(range.from, range.to, timezone),
          period,
        });
      } catch (error) {
        setCommandResult({ kind: 'error', message: commandError(error, '学习统计失败，请重试。') });
      }
      return;
    }

    if (command.name === 'find-record') {
      setCommandResult({ kind: 'loading', message: '正在检索资料…' });
      try {
        const page = await fetchRecordReferences(parsed.args, 20);
        setCommandResult({ kind: 'find-record', query: parsed.args, data: page.items, hasMore: page.hasMore });
      } catch (error) {
        setCommandResult({ kind: 'error', message: commandError(error, '资料检索失败，请重试。') });
      }
      return;
    }

    const referenceCommand = asRecordReferenceCommand(command.name);
    if (referenceCommand) {
      const requiredCount = RECORD_REFERENCE_LIMITS[referenceCommand];
      if (recordReferenceSelection.command !== referenceCommand
          || recordReferenceSelection.items.length !== requiredCount) {
        setCommandResult({
          kind: 'error',
          message: `请先用 ? 选择${requiredCount === 1 ? '一篇' : '两篇'}要引用的资料。`,
        });
        return;
      }
      const references = recordReferenceSelection.items;
      const referenceLabels = references.map((item) => `资料：${item.title || '无标题资料'}`).join('；');
      const modelContext = referenceCommand === 'ask-record'
        ? parsed.args
        : referenceCommand === 'summarize-record'
          ? `请为引用资料生成结构化摘要，包括核心主题、关键观点、重要细节和可执行结论；只依据资料内容，不确定之处请明确说明。${parsed.args ? `\n\n用户补充要求：${parsed.args}` : ''}`
          : `请比较两篇引用资料，分别概括核心观点，并列出共同点、关键差异、可能的互补关系与可执行结论；只依据资料内容。${parsed.args ? `\n\n用户补充要求：${parsed.args}` : ''}`;
      const displayPrompt = `/${referenceCommand} [${referenceLabels}]${parsed.args ? ` ${parsed.args}` : ''}`;
      setRecordReferenceSelection({ command: null, items: [] });
      setCommandResult(null);
      onSendMessage(displayPrompt, modelContext, references.map((item) => item.id));
      return;
    }

    if (isAnalysisCommand(command.name)) {
      try {
        const prepared = prepareAnalysisCommand(command.name, parsed.args);
        setCommandResult(null);
        if (prepared.privacyRequired) {
          setPendingAnalysis(prepared);
        } else {
          onSendMessage(prepared.displayPrompt, prepared.displayPrompt, [], prepared.request);
        }
      } catch (error) {
        setCommandResult({ kind: 'error', message: commandError(error, '分析命令参数不合法。') });
      }
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
        runtimeState: pendingPermission ? '等待权限确认' : isSessionStreaming ? '运行中' : '空闲',
        compactionState: '自动压缩已启用；最近一次压缩状态暂不可用',
        totalTokens: sessionUsageSummary?.totalTokens ?? 0,
        contextTokens: latestCall?.inputTokens ?? latestCall?.estimatedInputTokens,
        contextWindow: activeModel?.contextWindow,
      },
    });
  };

  const selectCommand = (command: SlashCommandDefinition) => {
    if (command.presentation.selection === 'IMMEDIATE') {
      setSelectedCommand(null);
      setRecordReferenceSelection({ command: null, items: [] });
      setInputPrompt('');
      setCommandMenuDismissed(true);
      void executeSlashCommand(`/${command.name}`);
      return;
    }
    const referenceCommand = asRecordReferenceCommand(command.name);
    setSelectedCommand(command);
    setCommandMenuDismissed(true);
    setCommandResult(null);
    if (referenceCommand) {
      setRecordReferenceSelection({ command: referenceCommand, items: [] });
      setInputPrompt('?');
      return;
    }
    setRecordReferenceSelection({ command: null, items: [] });
    setInputPrompt('');
  };

  const removeSelectedCommand = () => {
    if (asRecordReferenceCommand(selectedCommand?.name ?? '') && inputPrompt.trim() === '?') {
      setInputPrompt('');
    }
    setSelectedCommand(null);
    setRecordReferenceSelection({ command: null, items: [] });
    setCommandMenuDismissed(false);
  };

  const selectRecordReference = (reference: RecordReferenceOption) => {
    if (!activeRecordReferenceCommand) return;
    const command = activeRecordReferenceCommand;
    const nextItems = [...selectedRecordReferences, reference]
      .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
      .slice(0, RECORD_REFERENCE_LIMITS[command]);
    setRecordReferenceSelection({ command, items: nextItems });
    setInputPrompt(nextItems.length < RECORD_REFERENCE_LIMITS[command] ? '?' : '');
    setRecordReferenceIndex(0);
    setRecordReferencesError(null);
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (recordReferenceQuery !== null) {
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && availableRecordReferences.length > 0) {
        event.preventDefault();
        if (event.key === 'ArrowDown' && recordReferenceIndex === availableRecordReferences.length - 1
            && recordReferencesHasMore) {
          void loadMoreRecordReferences();
          return true;
        }
        const offset = event.key === 'ArrowDown' ? 1 : -1;
        setRecordReferenceIndex((index) =>
          (index + offset + availableRecordReferences.length) % availableRecordReferences.length);
        return true;
      }
      if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
        const selected = availableRecordReferences[recordReferenceIndex];
        if (selected) {
          event.preventDefault();
          selectRecordReference(selected);
        }
        return true;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setInputPrompt('');
        return true;
      }
    }
    if (selectedCommand && !inputPrompt && (event.key === 'Backspace' || event.key === 'Escape')) {
      event.preventDefault();
      removeSelectedCommand();
      return true;
    }
    if (commandSuggestions.length === 0) return false;
    if (event.key === ' ') {
      const parsed = parseSlashCommand(inputPrompt);
      const exactCommand = parsed && !parsed.args ? findSlashCommand(parsed.name) : undefined;
      if (exactCommand?.presentation.selection === 'COMPOSE') {
        event.preventDefault();
        selectCommand(exactCommand);
        return true;
      }
    }
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
    if (!selectedCommand && !inputPrompt.trim()) return;
    if (selectedCommand && !selectedCommandCanSend) return;
    const prompt = selectedCommand ? composedInputPrompt : inputPrompt.trim();
    setInputPrompt('');
    setSelectedCommand(null);
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
      {pendingAnalysis ? (
        <AnalysisPrivacyCard
          analysis={pendingAnalysis}
          onCancel={() => setPendingAnalysis(null)}
          onConfirm={() => {
            const confirmed = {
              ...pendingAnalysis.request,
              privacyConfirmed: true,
            };
            onSendMessage(pendingAnalysis.displayPrompt, pendingAnalysis.displayPrompt, [], confirmed);
            setPendingAnalysis(null);
          }}
        />
      ) : commandSuggestions.length > 0 ? (
        <SlashCommandMenu
          commands={commandSuggestions}
          selectedIndex={commandSelectedIndex}
          onSelect={selectCommand}
        />
      ) : recordReferenceQuery !== null ? (
        <RecordReferencePicker
          options={availableRecordReferences}
          selectedIndex={recordReferenceIndex}
          loading={recordReferencesLoading}
          error={recordReferencesError}
          hasMore={recordReferencesHasMore}
          loadingMore={recordReferencesLoadingMore}
          onSelect={selectRecordReference}
          onLoadMore={() => { void loadMoreRecordReferences(); }}
        />
      ) : commandResult ? (
        <SlashCommandResult result={commandResult} onClose={() => setCommandResult(null)} />
      ) : null}
      {selectedRecordReferences.length > 0 && (
        <div className={styles.recordReferenceChips} aria-label="已选择的资料引用">
          {selectedRecordReferences.map((reference) => (
            <RecordReferenceChip
              key={reference.id}
              reference={reference}
              onRemove={() => {
                const command = activeRecordReferenceCommand ?? recordReferenceSelection.command;
                if (!command) return;
                setRecordReferenceSelection((current) => ({
                  command,
                  items: current.items.filter((item) => item.id !== reference.id),
                }));
                setInputPrompt('?');
              }}
            />
          ))}
        </div>
      )}
      <PromptInput
        value={inputPrompt}
        onValueChange={handleInputValueChange}
        onSend={handleSend}
        onOpenSettings={onOpenSettings}
        permissionMode={permissionMode}
        onPermissionModeChange={onPermissionModeChange}
        isPermissionModeDisabled={isPermissionModeDisabled}
        isPermissionModeSaving={isPermissionModeSaving}
        onInputKeyDown={handleComposerKeyDown}
        leadingContent={selectedCommand ? (
          <SlashCommandChip command={selectedCommand} onRemove={removeSelectedCommand} />
        ) : undefined}
        canSend={selectedCommand ? selectedCommandCanSend : inputPrompt.trim().length > 0}
        placeholder={selectedCommand ? commandPromptPlaceholder(selectedCommand) : undefined}
        suggestionListId={commandSuggestions.length > 0
          ? 'slash-command-menu'
          : recordReferenceQuery !== null ? 'record-reference-list' : undefined}
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
                          <UserMessageContent content={msg.content} />
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

function commandError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function commandPromptPlaceholder(command: SlashCommandDefinition): string {
  if (command.name === 'help') return '输入要查询的命令名（可选）';
  if (command.name === 'rename') return '输入新的会话名称';
  if (command.name === 'find-record') return '输入资料关键词';
  if (command.name === 'ask-record') return '选择资料后输入你的问题';
  if (command.name === 'summarize-record' || command.name === 'compare-records') {
    return '选择资料后补充要求（可选）';
  }
  if (command.name === 'study-plan') return '输入你的学习目标';
  if (command.name === 'today' || command.name === 'agenda'
      || command.name === 'daily-review' || command.name === 'weekly-review') {
    return '输入日期 YYYY-MM-DD（可选）';
  }
  if (command.name === 'spending' || command.name === 'study-report'
      || command.name === 'todo-review' || command.name === 'finance-review'
      || command.name === 'study-review') {
    return '输入时间范围（可选）';
  }
  return '可直接发送';
}

function UserMessageContent({ content }: { content: string }) {
  const parsed = parseSlashCommand(content);
  const command = parsed ? findSlashCommand(parsed.name) : undefined;
  if (!parsed || !command || command.presentation.selection !== 'COMPOSE') {
    return <div className={styles.userMessage}>{content}</div>;
  }
  const display = parseSlashCommandDisplayArguments(parsed.args);
  return (
    <div className={`${styles.userMessage} ${styles.slashUserMessage}`}>
      <SlashCommandChip command={command} />
      {display.referenceTitles.map((title, index) => (
        <RecordReferenceTag key={`${title}-${index}`} title={title} />
      ))}
      {display.prompt && <span>{display.prompt}</span>}
    </div>
  );
}

export default ChatWorkspace;
