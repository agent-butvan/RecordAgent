export type SlashCommandName = 'help' | 'rename' | 'status' | 'tokens' | 'today'
  | 'agenda' | 'spending' | 'study-report' | 'find-record' | 'ask-record';

export interface SlashCommandDefinition {
  name: SlashCommandName;
  aliases: string[];
  description: string;
  usage: string;
  requiresArgs?: boolean;
}

export interface ParsedSlashCommand {
  name: string;
  args: string;
}

export const SLASH_COMMANDS: readonly SlashCommandDefinition[] = [
  {
    name: 'help',
    aliases: ['h'],
    description: '查询当前已有的命令以及描述',
    usage: '/help [命令名]',
  },
  {
    name: 'rename',
    aliases: [],
    description: '修改当前会话的名称',
    usage: '/rename <新名称>',
    requiresArgs: true,
  },
  {
    name: 'status',
    aliases: ['s'],
    description: '显示模型、会话、权限、Token 与上下文状态',
    usage: '/status',
  },
  {
    name: 'tokens',
    aliases: ['usage'],
    description: '打开当前会话的 Token 用量面板',
    usage: '/tokens',
  },
  {
    name: 'today',
    aliases: [],
    description: '汇总今日待办、日程、资料、花销与学习情况',
    usage: '/today [YYYY-MM-DD]',
  },
  {
    name: 'agenda',
    aliases: [],
    description: '查看指定日期的待办和日程',
    usage: '/agenda [YYYY-MM-DD]',
  },
  {
    name: 'spending',
    aliases: [],
    description: '统计今日、本周或本月的收支与支出分类',
    usage: '/spending [today|week|month]',
  },
  {
    name: 'study-report',
    aliases: [],
    description: '统计今日、本周或本月的学习投入',
    usage: '/study-report [today|week|month]',
  },
  {
    name: 'find-record',
    aliases: [],
    description: '按标题、正文和标签检索资料',
    usage: '/find-record <关键词>',
    requiresArgs: true,
  },
  {
    name: 'ask-record',
    aliases: [],
    description: '引用一篇资料并根据其内容回答问题',
    usage: '/ask-record ? <问题>',
    requiresArgs: true,
  },
] as const;

const COMMAND_TOKEN = /^[a-zA-Z][a-zA-Z0-9-]*$/;

/** 仅识别合法命令形态，避免把 /Users/foo 等绝对路径误判为命令。 */
export function parseSlashCommand(input: string): ParsedSlashCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;

  const body = trimmed.slice(1);
  if (!body) return { name: '', args: '' };
  const separator = body.search(/\s/);
  const rawName = separator < 0 ? body : body.slice(0, separator);
  if (!COMMAND_TOKEN.test(rawName)) return null;
  return {
    name: rawName.toLowerCase(),
    args: separator < 0 ? '' : body.slice(separator).trim(),
  };
}

export function findSlashCommand(name: string): SlashCommandDefinition | undefined {
  const normalized = name.toLowerCase();
  return SLASH_COMMANDS.find((command) =>
    command.name === normalized || command.aliases.includes(normalized));
}

/** 输入仍处于命令名阶段时返回建议；出现参数后由具体命令接管。 */
export function suggestSlashCommands(input: string): SlashCommandDefinition[] {
  if (!input.startsWith('/') || input.startsWith('//')) return [];
  const query = input.slice(1);
  if (/\s/.test(query) || !/^[a-zA-Z0-9-]*$/.test(query)) return [];
  const normalized = query.toLowerCase();
  return SLASH_COMMANDS.filter((command) =>
    command.name.startsWith(normalized)
      || command.aliases.some((alias) => alias.startsWith(normalized)));
}

export function validateSlashCommandRegistry(
  commands: readonly SlashCommandDefinition[] = SLASH_COMMANDS,
): void {
  const owners = new Map<string, string>();
  commands.forEach((command) => {
    [command.name, ...command.aliases].forEach((key) => {
      const normalized = key.toLowerCase();
      const owner = owners.get(normalized);
      if (owner) throw new Error(`Slash Command 名称冲突：${normalized}（${owner} / ${command.name}）`);
      owners.set(normalized, command.name);
    });
  });
}

validateSlashCommandRegistry();
