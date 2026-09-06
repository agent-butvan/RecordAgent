import React from 'react';
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  BookOpenIcon,
  BriefcaseIcon,
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
import styles from './TransactionTypeIcon.module.css';

interface TransactionTypeIconProps {
  type: FinanceTransactionType;
  category?: string;
}

const EXPENSE_ICONS: Record<string, Icon> = {
  餐饮: ForkKnifeIcon, 交通: TrainIcon, 购物: ShoppingBagIcon, 居住: HouseIcon,
  娱乐: FilmSlateIcon, 学习: BookOpenIcon, 医疗: HeartbeatIcon,
};
const INCOME_ICONS: Record<string, Icon> = {
  工资: BriefcaseIcon, 奖金: GiftIcon, 报销: ReceiptIcon, 转入: ArrowDownLeftIcon, 兼职: BriefcaseIcon,
};

/** 流水以图形表达分类、色相表达收支；未知分类保留方向箭头。 */
export const TransactionTypeIcon: React.FC<TransactionTypeIconProps> = ({ type, category = '' }) => {
  const categoryIcons = type === 'expense' ? EXPENSE_ICONS : INCOME_ICONS;
  const fallback = type === 'expense' ? ArrowUpRightIcon : ArrowDownLeftIcon;
  const CategoryIcon = type === 'yield' ? PlantIcon
    : Object.hasOwn(categoryIcons, category) ? categoryIcons[category] : fallback;
  return <span className={`${styles.icon} ${styles[type]}`} aria-hidden="true">
    <CategoryIcon size={16} />
  </span>;
};
