import React from 'react';
import { ArrowDownLeft, ArrowUpRight, BookOpen, BriefcaseBusiness, Gift, HeartPulse, House, ReceiptText, ShoppingBag, Sprout, TrainFront, Utensils, Clapperboard, type LucideIcon } from 'lucide-react';
import type { FinanceTransactionType } from '../../types/finance';
import styles from './TransactionTypeIcon.module.css';

interface TransactionTypeIconProps {
  type: FinanceTransactionType;
  category?: string;
}

const EXPENSE_ICONS: Record<string, LucideIcon> = {
  餐饮: Utensils, 交通: TrainFront, 购物: ShoppingBag, 居住: House,
  娱乐: Clapperboard, 学习: BookOpen, 医疗: HeartPulse,
};
const INCOME_ICONS: Record<string, LucideIcon> = {
  工资: BriefcaseBusiness, 奖金: Gift, 报销: ReceiptText, 转入: ArrowDownLeft, 兼职: BriefcaseBusiness,
};

/** 流水以图形表达分类、色相表达收支；未知分类保留方向箭头。 */
export const TransactionTypeIcon: React.FC<TransactionTypeIconProps> = ({ type, category = '' }) => {
  const categoryIcons = type === 'expense' ? EXPENSE_ICONS : INCOME_ICONS;
  const fallback = type === 'expense' ? ArrowUpRight : ArrowDownLeft;
  const Icon = type === 'yield' ? Sprout
    : Object.hasOwn(categoryIcons, category) ? categoryIcons[category] : fallback;
  return <span className={`${styles.icon} ${styles[type]}`} aria-hidden="true">
    <Icon size={16} strokeWidth={1.75} />
  </span>;
};
