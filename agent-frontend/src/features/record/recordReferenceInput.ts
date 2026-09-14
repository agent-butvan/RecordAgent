/**
 * 解析聊天输入框中的直接资料引用触发词。
 * 仅当输入以半角 `?` 开头且尚未选择资料时返回候选检索词。
 */
export function parseDirectRecordReferenceQuery(input: string, selectedCount: number): string | null {
  if (selectedCount > 0) return null;
  const match = input.match(/^\?([^?]*)$/);
  return match ? match[1].trim() : null;
}
