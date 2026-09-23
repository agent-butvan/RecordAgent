import type { ReactNode } from 'react';
import { Button, type ButtonProps } from './Button';

/** 顶栏操作统一使用紧凑尺寸；纯图标操作必须提供可访问名称。 */
type TopBarActionProps = Omit<ButtonProps, 'size' | 'className' | 'style' | 'children'> & (
  | { iconOnly: true; 'aria-label': string; children: ReactNode }
  | { iconOnly?: false; children: ReactNode }
);

export const TopBarAction = ({ variant = 'ghost', type = 'button', ...props }: TopBarActionProps) => (
  <Button type={type} variant={variant} size="toolbar" {...props} />
);
