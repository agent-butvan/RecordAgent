export interface SlashCommandDisplayArguments {
  prompt: string;
  referenceTitles: string[];
}

/** 从持久化的用户消息中恢复资料引用标签，兼容已有 `[资料：…]` 文本格式。 */
export function parseSlashCommandDisplayArguments(args: string): SlashCommandDisplayArguments {
  const referenceMatch = args.match(/^\[资料：(.+)](?:\s+([\s\S]*))?$/);
  if (!referenceMatch) return { prompt: args, referenceTitles: [] };
  return {
    prompt: referenceMatch[2]?.trim() ?? '',
    referenceTitles: referenceMatch[1]
      .split('；资料：')
      .map((title) => title.trim())
      .filter(Boolean),
  };
}
