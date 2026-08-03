import React from 'react';
import { Plus, MessageSquare, Settings, Bot, Sliders } from 'lucide-react';
import styles from './Sidebar.module.css';

interface SidebarProps {
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSessionId,
  onSelectSession,
  onNewChat,
  onOpenSettings,
}) => {
  const dummySessions = [
    { id: '1', title: 'DeepSeek R1 模型测试与逻辑推理' },
    { id: '2', title: 'ButvanAgent 多厂商架构重构' },
    { id: '3', title: 'Tauri 2.0 桌面端工程搭建' },
  ];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.topSection}>
        <div className={styles.brand}>
          <div className={styles.brandLogo}>
            <Bot size={15} />
          </div>
          <span>ButvanAgent</span>
        </div>

        <button className={styles.newChatBtn} onClick={onNewChat}>
          <Plus size={16} />
          新 Agent 对话
        </button>

        <div className={styles.sessionList}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', padding: '4px 8px' }}>
            近期对话
          </div>
          {dummySessions.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <button
                key={session.id}
                className={`${styles.sessionItem} ${isActive ? styles.sessionActive : ''}`}
                onClick={() => onSelectSession(session.id)}
              >
                <MessageSquare size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.bottomSection}>
        <button className={styles.footerBtn} onClick={onOpenSettings}>
          <Sliders size={16} />
          模型与 API 设置
        </button>
        <button className={styles.footerBtn} onClick={onOpenSettings}>
          <Settings size={16} />
          偏好设置
        </button>
      </div>
    </aside>
  );
};
