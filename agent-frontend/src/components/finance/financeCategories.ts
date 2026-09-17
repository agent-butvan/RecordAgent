/** 手工流水支持的完整分类集合，供录入表单与图标映射共享。 */
export const EXPENSE_CATEGORIES = ['餐饮', '交通', '购物', '居住', '娱乐', '学习', '医疗', '其他'] as const;
export const INCOME_CATEGORIES = ['工资', '奖金', '报销', '转入', '兼职', '其他'] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];
export type IncomeCategory = typeof INCOME_CATEGORIES[number];
