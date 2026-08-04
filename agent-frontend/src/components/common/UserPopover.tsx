import React from 'react';
import {
  Gauge,
  Cat,
  Sparkles,
  Settings as SettingsIcon,
  LogOut,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import styles from './UserPopover.module.css';

export interface UserPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

export const UserPopover: React.FC<UserPopoverProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
}) => {
  if (!isOpen) return null;

  return (
    <>
      <div className={styles.popoverOverlay} onClick={onClose} />
      <div className={styles.popoverCard}>
        {/* Header Profile Info */}
        <div className={styles.header}>
          <div className={styles.avatar}>BA</div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>ButvanAgent</span>
            <span className={styles.userPlan}>免费社区版</span>
          </div>
        </div>

        {/* Menu Items matching Screenshot 2 */}
        <div className={styles.menuList}>
          <button className={styles.menuItem} onClick={() => { onClose(); onOpenSettings(); }}>
            <div className={styles.menuItemLeft}>
              <Gauge size={14} />
              <span>剩余用量</span>
            </div>
            <ChevronRight size={14} style={{ color: '#94a3b8' }} />
          </button>

          <button className={styles.menuItem} onClick={() => { onClose(); onOpenSettings(); }}>
            <div className={styles.menuItemLeft}>
              <Cat size={14} />
              <span>显示宠物</span>
            </div>
          </button>

          <button className={styles.menuItem} onClick={() => { onClose(); onOpenSettings(); }}>
            <div className={styles.menuItemLeft}>
              <Sparkles size={14} style={{ color: '#9333ea' }} />
              <span>升级以获享更高限额</span>
            </div>
            <ExternalLink size={13} style={{ color: '#94a3b8' }} />
          </button>

          <button className={styles.menuItem} onClick={() => { onClose(); onOpenSettings(); }}>
            <div className={styles.menuItemLeft}>
              <SettingsIcon size={14} />
              <span>设置</span>
            </div>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>⌘,</span>
          </button>

          <button className={styles.menuItem} onClick={() => { onClose(); alert('已重置会话'); }}>
            <div className={styles.menuItemLeft}>
              <LogOut size={14} style={{ color: '#ef4444' }} />
              <span style={{ color: '#ef4444' }}>重置状态</span>
            </div>
          </button>
        </div>
      </div>
    </>
  );
};
