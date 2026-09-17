/** 合并内置与用户分类，去除空值和重复项。 */
export function mergeCategoryOptions(defaults: readonly string[], remembered: readonly string[]): string[] {
  return [...new Set([...defaults, ...remembered].map((item) => item.trim()).filter(Boolean))];
}
