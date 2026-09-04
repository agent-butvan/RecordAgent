import React from 'react';
import type { FinanceAccountType } from '../../types/finance';

interface AccountTypeIconProps {
  type: FinanceAccountType;
  size?: number;
}

/** 六类资产账户的轻量线性图标，并兼容历史账户类型。 */
export const AccountTypeIcon: React.FC<AccountTypeIconProps> = ({ type, size = 18 }) => {
  const resolvedType = type === 'wechat' ? 'wechat_balance'
    : type === 'alipay' ? 'alipay_balance'
      : type === 'cash' ? 'other' : type;
  const common = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.55, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (resolvedType === 'wechat_balance') return <svg {...common}>
    <path d="M4.2 6.4c0-2.1 2.1-3.8 4.7-3.8s4.7 1.7 4.7 3.8-2.1 3.8-4.7 3.8c-.6 0-1.1-.1-1.6-.2L4.7 11l.8-2a3.5 3.5 0 0 1-1.3-2.6Z" />
    <path d="M10.3 12.7c0-2.4 2.3-4.3 5.1-4.3s5.1 1.9 5.1 4.3c0 1.1-.5 2.1-1.4 2.9l.8 2.4-2.7-1.2c-.6.2-1.2.3-1.8.3-2.8 0-5.1-2-5.1-4.4Z" />
    <path d="M7.1 6.1h.1M10.5 6.1h.1M13.9 12.3h.1M17.3 12.3h.1" />
  </svg>;
  if (resolvedType === 'wechat_yield') return <svg {...common}>
    <path d="M3.7 7.1c0-2.5 2.4-4.5 5.4-4.5s5.4 2 5.4 4.5-2.4 4.5-5.4 4.5c-.7 0-1.3-.1-1.9-.3L4.3 12.5l.8-2.4a4 4 0 0 1-1.4-3Z" />
    <path d="M7.2 6.8h.1M10.9 6.8h.1M11.7 17.2l2.2-2.2 2 1.7 4.1-4.1M17.1 12.6H20v2.9" />
  </svg>;
  if (resolvedType === 'alipay_balance') return <svg {...common}>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="M7.2 9.1h9.6M9.1 6.5h5.8M12 6.5v6.8M7.6 13.1c2.7 2.3 5.6 3.7 9 4.2M16.3 10.8c-1.5 3.1-4.4 5.4-8.7 6.5" />
  </svg>;
  if (resolvedType === 'alipay_yuebao') return <svg {...common}>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="M7.2 9.4h6.7M9 6.7h4.1M10.6 6.7v6.2M7.4 13c1.8 1.5 3.5 2.4 5.4 2.9M12.7 11.2c-.9 2.2-2.5 3.9-5 5.2M15.5 17.7v-3.3M15.5 14.5c.3-1.8 1.4-2.7 3.1-2.8-.1 1.8-1.1 2.7-3.1 2.8Z" />
  </svg>;
  if (resolvedType === 'bank') return <svg {...common}>
    <rect x="2.8" y="5" width="18.4" height="14" rx="2.8" />
    <path d="M2.8 9.2h18.4M6.5 14.5h4.2M6.5 16.8h2.2" />
  </svg>;
  return <svg {...common}>
    <path d="M4 7.2h13.4A2.6 2.6 0 0 1 20 9.8v7.1a2.6 2.6 0 0 1-2.6 2.6H5.7A2.7 2.7 0 0 1 3 16.8V6.6a2.1 2.1 0 0 1 2.1-2.1h10.4" />
    <path d="M15 11.2h5v4.2h-5a2.1 2.1 0 1 1 0-4.2ZM15.1 13.3h.1" />
  </svg>;
};
