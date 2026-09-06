import React from 'react';
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  BookOpenIcon,
  BriefcaseIcon,
  CoinsIcon,
  DotsThreeCircleIcon,
  FilmSlateIcon,
  ForkKnifeIcon,
  GiftIcon,
  HeartbeatIcon,
  HouseIcon,
  PlantIcon,
  ReceiptIcon,
  ShoppingBagIcon,
  TrainIcon,
  type Icon,
} from '@phosphor-icons/react';
import type { FinanceTransactionType } from '../../types/finance';
import type { ExpenseCategory, IncomeCategory } from './financeCategories';
import styles from './TransactionTypeIcon.module.css';

interface TransactionTypeIconProps {
  type: FinanceTransactionType;
  category?: string;
  compact?: boolean;
}

const EXPENSE_ICONS = {
  餐饮: ForkKnifeIcon, 交通: TrainIcon, 购物: ShoppingBagIcon, 居住: HouseIcon,
  娱乐: FilmSlateIcon, 学习: BookOpenIcon, 医疗: HeartbeatIcon, 其他: DotsThreeCircleIcon,
} satisfies Record<ExpenseCategory, Icon>;
const INCOME_ICONS = {
  工资: BriefcaseIcon, 奖金: GiftIcon, 报销: ReceiptIcon, 转入: ArrowDownLeftIcon, 兼职: BriefcaseIcon,
  其他: CoinsIcon,
} satisfies Record<IncomeCategory, Icon>;

/** 每个内置流水分类使用专属图标；历史或外部分类保留收支方向图标。 */
export const TransactionTypeIcon: React.FC<TransactionTypeIconProps> = ({ type, category = '', compact = false }) => {
  const categoryIcons = type === 'expense' ? EXPENSE_ICONS : INCOME_ICONS;
  const fallback = type === 'expense' ? ArrowUpRightIcon : ArrowDownLeftIcon;
  const CategoryIcon = type === 'yield' ? PlantIcon
    : Object.hasOwn(categoryIcons, category) ? categoryIcons[category as keyof typeof categoryIcons] : fallback;
  return <span className={`${styles.icon} ${styles[type]} ${compact ? styles.compact : ''}`} aria-hidden="true">
    <CategoryIcon size={compact ? 14 : 16} />
  </span>;
};
