import React from 'react';
import { ChevronDown, Search, SquarePen, Download } from 'lucide-react';
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
    { id: '1', title: '显示隐藏文件' },
    { id: '2', title: '取免费记账App名' },
    { id: '3', title: '提取PPT备注到Word' },
    { id: '4', title: '介绍插件用途' },
    { id: '5', title: '请你使用ssh root@10.100.242.163' },
    { id: '6', title: '导出台词到Word' },
    { id: '7', title: '定位项目级 rules 配置' },
    { id: '8', title: '请你阅读理解一下这个ppt总体' },
    { id: '9', title: '排查显卡无显示' },
    { id: '10', title: '按页总结PPT备注' },
    { id: '11', title: '分析PPT评分标准' },
    { id: '12', title: '解读这份PPT' },
    { id: '13', title: '小红书搜瑞幸考试题目' },
  ];

  return (
    <aside className={styles.sidebar}>
      <div>
        {/* macOS Traffic Light Buttons */}
        <div className={styles.trafficLights}>
          <div className={`${styles.dot} ${styles.red}`} />
          <div className={`${styles.dot} ${styles.yellow}`} />
          <div className={`${styles.dot} ${styles.green}`} />
        </div>

        {/* Header Title Dropdown & Search Icon */}
        <div className={styles.header}>
          <div className={styles.headerTitle} onClick={onOpenSettings}>
            Codex
            <ChevronDown size={14} style={{ opacity: 0.7 }} />
          </div>
          <button className={styles.searchBtn} title="搜索设置与历史">
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
          {dummySessions.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <button
                key={session.id}
                className={`${styles.sessionItem} ${isActive ? styles.sessionActive : ''}`}
                onClick={() => onSelectSession(session.id)}
              >
                {session.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Profile Pill & Action Icon */}
      <div className={styles.footer}>
        <div className={styles.userProfile} onClick={onOpenSettings}>
          <div className={styles.avatarCircle}>wj</div>
          <span className={styles.userName}>wj</span>
        </div>
        <button className={styles.actionIcon} title="导出/下载">
          <Download size={13} />
        </button>
      </div>
    </aside>
  );
};
