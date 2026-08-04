import React from 'react';
import { ChevronDown, Search, SquarePen, Trash2, Settings } from 'lucide-react';
import type { ChatSession } from '../../types/chat';
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
  return (
    <aside className={styles.sidebar}>
      <div className={styles.topContainer}>
        {/* macOS Traffic Light Buttons */}
        <div className={styles.trafficLights}>
          <div className={`${styles.dot} ${styles.red}`} />
          <div className={`${styles.dot} ${styles.yellow}`} />
          <div className={`${styles.dot} ${styles.green}`} />
        </div>

        {/* Header Title Dropdown & Search Icon */}
        <div className={styles.header}>
          <div className={styles.headerTitle} onClick={onOpenSettings} title="点击进行系统与模型设置">
            ButvanAgent
            <ChevronDown size={14} style={{ opacity: 0.7 }} />
          </div>
          <button className={styles.searchBtn} title="查看设置" onClick={onOpenSettings}>
            <Search size={14} />
          </button>
        </div>

        {/* New Task Button */}
        <button className={styles.newChatBtn} onClick={onNewChat}>
          <SquarePen size={15} />
          新建任务
        </button>

        {/* Conversation Tasks List */}
        <div className={styles.sessionList}>
          {sessions.length === 0 ? (
            <div className={styles.emptySessionState}>
              <span>暂无历史任务</span>
              <p>点击上方“新建任务”开始对话</p>
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
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Profile Pill & Action Icon */}
      <div className={styles.footer}>
        <div className={styles.userProfile} onClick={onOpenSettings} title="个人中心与模型配置">
          <div className={styles.avatarCircle}>BA</div>
          <span className={styles.userName}>ButvanAgent</span>
        </div>
        <button className={styles.actionIcon} title="模型配置与设置" onClick={onOpenSettings}>
          <Settings size={13} />
        </button>
      </div>
    </aside>
  );
};
