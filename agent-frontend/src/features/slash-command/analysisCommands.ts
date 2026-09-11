import type { AgentAnalysisContextRequest } from '../../types/chat';
import {
  parseOptionalDateArgument,
  parseQueryPeriod,
  queryPeriodRange,
  type SlashQueryPeriod,
} from './slashCommandArguments.ts';
import type { SlashCommandName } from './slashCommands.ts';

export interface PreparedAnalysisCommand {
  displayPrompt: string;
  sourceLabel: string;
  scopeLabel: string;
  privacyRequired: boolean;
  request: AgentAnalysisContextRequest;
}

const ANALYSIS_COMMANDS = new Set<SlashCommandName>([
  'daily-review', 'weekly-review', 'todo-review', 'finance-review', 'study-review', 'study-plan',
]);

export function isAnalysisCommand(name: SlashCommandName): name is AgentAnalysisContextRequest['command'] {
  return ANALYSIS_COMMANDS.has(name);
}

/** 校验命令参数并生成用户可见的数据来源、范围和服务端分析意图。 */
export function prepareAnalysisCommand(
  command: AgentAnalysisContextRequest['command'],
  rawArgument: string,
  now = new Date(),
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): PreparedAnalysisCommand {
  const argument = normalizeArgument(command, rawArgument, now);
  const metadata = analysisMetadata(command, argument, now);
  const visibleArgument = command === 'study-plan' ? ` ${argument}` : '';
  return {
    displayPrompt: `/${command}${visibleArgument} [数据：${metadata.sourceLabel} · ${metadata.scopeLabel}]`,
    ...metadata,
    request: { command, argument, timezone, privacyConfirmed: false },
  };
}

function normalizeArgument(
  command: AgentAnalysisContextRequest['command'],
  rawArgument: string,
  now: Date,
): string {
  if (command === 'daily-review' || command === 'weekly-review') {
    return parseOptionalDateArgument(rawArgument, now);
  }
  if (command === 'todo-review') {
    const period = parseQueryPeriod(rawArgument, 'week');
    if (period === 'month') throw new Error('待办分析仅支持 today 或 week。');
    return period;
  }
  if (command === 'finance-review' || command === 'study-review') {
    const period = parseQueryPeriod(rawArgument, 'month');
    if (period === 'today') throw new Error('该分析仅支持 week 或 month。');
    return period;
  }
  const goal = rawArgument.trim();
  if (!goal) throw new Error('请填写学习目标。');
  if (goal.length > 500) throw new Error('学习目标不能超过 500 个字符。');
  return goal;
}

function analysisMetadata(
  command: AgentAnalysisContextRequest['command'],
  argument: string,
  now: Date,
): Pick<PreparedAnalysisCommand, 'sourceLabel' | 'scopeLabel' | 'privacyRequired'> {
  if (command === 'daily-review') {
    return { sourceLabel: '日历、资料、财务、学习', scopeLabel: argument, privacyRequired: true };
  }
  if (command === 'weekly-review') {
    const anchor = new Date(`${argument}T12:00:00`);
    const weekday = anchor.getDay() || 7;
    const monday = new Date(anchor);
    monday.setDate(anchor.getDate() - weekday + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      sourceLabel: '日历、资料、财务、学习',
      scopeLabel: `${formatDate(monday)} 至 ${formatDate(sunday)}`,
      privacyRequired: true,
    };
  }
  if (command === 'todo-review') {
    const range = queryPeriodRange(knownPeriod(argument), now);
    return { sourceLabel: '日历待办', scopeLabel: `${range.from} 至 ${range.to}`, privacyRequired: false };
  }
  if (command === 'finance-review') {
    const range = queryPeriodRange(knownPeriod(argument), now);
    return {
      sourceLabel: '收支汇总、每日趋势、支出分类',
      scopeLabel: `${range.from} 至 ${range.to}`,
      privacyRequired: true,
    };
  }
  const range = queryPeriodRange('month', now);
  if (command === 'study-plan') {
    return { sourceLabel: '近期学习统计与记录', scopeLabel: `${range.from} 至 ${range.to}`, privacyRequired: false };
  }
  const reviewRange = queryPeriodRange(knownPeriod(argument), now);
  return {
    sourceLabel: '学习统计与记录',
    scopeLabel: `${reviewRange.from} 至 ${reviewRange.to}`,
    privacyRequired: false,
  };
}

function knownPeriod(value: string): SlashQueryPeriod {
  if (value === 'today' || value === 'week' || value === 'month') return value;
  throw new Error('分析时间范围不合法。');
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
