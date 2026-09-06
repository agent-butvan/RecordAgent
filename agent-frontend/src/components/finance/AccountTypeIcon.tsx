import React from 'react';
import {
  BankIcon,
  ChartLineUpIcon,
  ChatCircleDotsIcon,
  CurrencyCircleDollarIcon,
  PiggyBankIcon,
  WalletIcon,
  type Icon,
} from '@phosphor-icons/react';
import type { FinanceAccountType } from '../../types/finance';
import styles from './AccountTypeIcon.module.css';

interface AccountTypeIconProps {
  type: FinanceAccountType;
  size?: number;
  variant?: 'plain' | 'tile';
}

/** 统一账户图标的尺寸、底色与描边；紧凑导航保留无底色版本。 */
export const AccountTypeIcon: React.FC<AccountTypeIconProps> = ({ type, size = 18, variant = 'plain' }) => {
  const glyph = <AccountGlyph type={type} size={size} />;
  if (variant === 'plain') return glyph;
  const tone = type.startsWith('wechat') ? styles.wechat
    : type.startsWith('alipay') ? styles.alipay
      : type === 'bank' ? styles.bank : styles.other;
  return <span className={`${styles.tile} ${tone}`} aria-hidden="true"
    style={{ width: size + 12, height: size + 12 }}>{glyph}</span>;
};

/** 六类资产账户的轻量线性图标，并兼容历史账户类型。 */
const AccountGlyph: React.FC<Pick<AccountTypeIconProps, 'type' | 'size'>> = ({ type, size }) => {
  const resolvedType = type === 'wechat' ? 'wechat_balance'
    : type === 'alipay' ? 'alipay_balance'
      : type === 'cash' ? 'other' : type;
  const glyphs: Record<typeof resolvedType, Icon> = {
    wechat_balance: ChatCircleDotsIcon,
    wechat_yield: ChartLineUpIcon,
    alipay_balance: CurrencyCircleDollarIcon,
    alipay_yuebao: PiggyBankIcon,
    bank: BankIcon,
    other: WalletIcon,
  };
  const Glyph = glyphs[resolvedType];
  return <Glyph className={styles.glyph} size={size} aria-hidden="true" />;
};
