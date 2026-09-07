const TOKEN_FORMATTER = new Intl.NumberFormat('zh-CN');

/** 以当前产品中文界面使用的千分位格式展示 Token 数量。 */
export function formatTokenCount(value: number): string {
  return TOKEN_FORMATTER.format(Math.max(0, value));
}
