import React, { useState } from 'react';
import {
  ChevronDown,
  Search,
  SquarePen,
  Trash2,
  Bell,
  GitPullRequest,
  Clock,
  Plug,
  Folder,
  Plus,
  MoreHorizontal,
  HelpCircle
} from 'lucide-react';
import type { ChatSession } from '../../types/chat';
import { UserPopover } from '../common/UserPopover';
import styles from './Sidebar.module.css';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onOpenSettings,
}) => {
  const [isUserPopoverOpen, setIsUserPopoverOpen] = useState(false);
  const [isProjectExpanded, setIsProjectExpanded] = useState(true);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.topContainer}>
        {/* macOS Traffic Light Buttons */}
        <div className={styles.trafficLights}>
          <div className={`${styles.dot} ${styles.red}`} />
          <div className={`${styles.dot} ${styles.yellow}`} />
          <div className={`${styles.dot} ${styles.green}`} />
        </div>

        {/* Header Title Dropdown & Search/Bell Icons matching Screenshot 1 */}
        <div className={styles.header}>
          <div className={styles.headerTitle} onClick={onOpenSettings} title="切换工作区 / 点击设置">
            Codex
            <ChevronDown size={14} style={{ opacity: 0.7 }} />
          </div>
          <div className={styles.headerIcons}>
            <button className={styles.iconBtn} title="搜索" onClick={onOpenSettings}>
              <Search size={14} />
            </button>
            <button className={styles.iconBtn} title="通知中心" onClick={onOpenSettings}>
              <Bell size={14} />
            </button>
          </div>
        </div>

        {/* Quick Nav List matching Screenshot 1 */}
        <div className={styles.quickNavGroup}>
          <button className={styles.navItem} onClick={onNewChat}>
            <SquarePen size={14} /> 新对话
          </button>
          <button className={styles.navItem}>
            <GitPullRequest size={14} /> 拉取请求
          </button>
          <button className={styles.navItem}>
            <Clock size={14} /> 已安排
          </button>
          <button className={styles.navItem}>
            <Plug size={14} /> 插件
          </button>
        </div>

        {/* Project Group Header matching Screenshot 1 */}
        <div className={styles.groupHeader}>
          <span className={styles.groupTitle}>项目</span>
          <div className={styles.groupActions}>
            <button className={styles.iconBtnSmall} title="更多操作"><MoreHorizontal size={13} /></button>
            <button className={styles.iconBtnSmall} title="添加项目" onClick={onNewChat}><Plus size={13} /></button>
          </div>
        </div>

        {/* Active Project Folder Card & Sessions List */}
        <div className={styles.projectCard}>
          <div className={styles.projectFolderHead} onClick={() => setIsProjectExpanded(!isProjectExpanded)}>
            <Folder size={14} style={{ color: '#2563eb' }} />
            <span className={styles.projectName}>ButvanAgent</span>
          </div>

          {isProjectExpanded && (
            <div className={styles.sessionList}>
              {sessions.length === 0 ? (
                <div className={styles.emptySessionState}>
                  <span>暂无历史任务</span>
                  <p>点击上方“新对话”开始</p>
                </div>
              ) : (
                sessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  return (
                    <div
                      key={session.id}
                      className={`${styles.sessionItem} ${isActive ? styles.sessionActive : ''}`}
                      onClick={() => onSelectSession(session.id)}
                    >
                      <span className={styles.sessionTitle} title={session.title}>
                        {session.title || '新对话'}
                      </span>
                      <button
                        className={styles.deleteBtn}
                        title="删除会话"
                        onClick={(e) => onDeleteSession(session.id, e)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Profile Pill & User Popover Card matching Screenshot 2 */}
      <div className={styles.footer}>
        <UserPopover
          isOpen={isUserPopoverOpen}
          onClose={() => setIsUserPopoverOpen(false)}
          onOpenSettings={onOpenSettings}
        />
        <div
          className={styles.userProfile}
          onClick={() => setIsUserPopoverOpen(!isUserPopoverOpen)}
          title="点击展开个人与系统菜单"
        >
          <div className={styles.avatarCircle}>SB</div>
          <span className={styles.userName}>Sean Bailey</span>
        </div>
        <button className={styles.actionIcon} title="帮助与中心" onClick={onOpenSettings}>
          <HelpCircle size={14} />
        </button>
      </div>
    </aside>
  );
};
