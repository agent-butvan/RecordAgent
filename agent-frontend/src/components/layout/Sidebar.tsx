import React, { useState } from 'react';
import {
  SquarePen,
  Trash2,
  Folder,
  Plus,
  HelpCircle,
  FolderPlus,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  X,
  FolderOpen
} from 'lucide-react';
import type { ChatSession, Project } from '../../types/chat';
import { UserPopover } from '../common/UserPopover';
import styles from './Sidebar.module.css';

interface SidebarProps {
  projects: Project[];
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewGeneralChat: () => void;
  onNewProjectChat: (projectId: string) => void;
  onImportProject: (name: string, path: string) => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  projects,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewGeneralChat,
  onNewProjectChat,
  onImportProject,
  onDeleteSession,
  onOpenSettings,
}) => {
  const [isUserPopoverOpen, setIsUserPopoverOpen] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPath, setImportPath] = useState('');
  const [importName, setImportName] = useState('');

  // 区分普通会话与关联具体项目的会话
  const generalSessions = sessions.filter((s) => !s.projectId);

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const handleConfirmImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importPath.trim()) return;
    const name = importName.trim() || importPath.split('/').filter(Boolean).pop() || '未命名项目';
    onImportProject(name, importPath.trim());
    setImportPath('');
    setImportName('');
    setIsImportModalOpen(false);
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.topContainer}>
        {/* 新建普通会话按钮 */}
        <div className={styles.newChatHeader}>
          <button className={styles.newChatBtn} onClick={onNewGeneralChat} title="新建普通会话">
            <SquarePen size={15} />
            <span>新对话</span>
          </button>
        </div>

        {/* 1. 项目大类 */}
        <div className={styles.sectionGroup}>
          <div className={styles.groupHeader}>
            <span className={styles.groupTitle}>项目</span>
            <button
              className={styles.iconBtnSmall}
              title="导入本地项目"
              onClick={() => setIsImportModalOpen(true)}
            >
              <FolderPlus size={14} />
            </button>
          </div>

          {projects.length === 0 ? (
            <div className={styles.emptyStateContainer} onClick={() => setIsImportModalOpen(true)}>
              <FolderOpen size={18} style={{ opacity: 0.5, marginBottom: '4px' }} />
              <span>暂无导入的项目</span>
              <button className={styles.importLinkBtn}>+ 点击导入项目</button>
            </div>
          ) : (
            <div className={styles.projectList}>
              {projects.map((project) => {
                const isExpanded = expandedProjects[project.id] ?? true;
                const projectSessions = sessions.filter((s) => s.projectId === project.id);

                return (
                  <div key={project.id} className={styles.projectItemContainer}>
                    <div className={styles.projectHead}>
                      <div className={styles.projectHeadLeft} onClick={() => toggleProject(project.id)}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <Folder size={14} style={{ color: '#2563eb', marginLeft: '4px' }} />
                        <span className={styles.projectName} title={project.path}>{project.name}</span>
                      </div>
                      <button
                        className={styles.iconBtnSmall}
                        title="在此项目下新建会话"
                        onClick={() => onNewProjectChat(project.id)}
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    {isExpanded && (
                      <div className={styles.projectSubSessions}>
                        {projectSessions.length === 0 ? (
                          <div className={styles.subEmpty}>暂无项目对话</div>
                        ) : (
                          projectSessions.map((session) => {
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
                );
              })}
            </div>
          )}
        </div>

        {/* 2. 最近 / 普通会话 */}
        <div className={styles.sectionGroup}>
          <div className={styles.groupHeader}>
            <span className={styles.groupTitle}>最近</span>
          </div>

          <div className={styles.sessionList}>
            {generalSessions.length === 0 ? (
              <div className={styles.emptySessionState}>
                <span>暂无最近普通对话</span>
              </div>
            ) : (
              generalSessions.map((session) => {
                const isActive = session.id === activeSessionId;
                return (
                  <div
                    key={session.id}
                    className={`${styles.sessionItem} ${isActive ? styles.sessionActive : ''}`}
                    onClick={() => onSelectSession(session.id)}
                  >
                    <MessageSquare size={13} style={{ opacity: 0.6, flexShrink: 0 }} />
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
        </div>
      </div>

      {/* 导入项目 UI 弹窗 */}
      {isImportModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsImportModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>导入本地项目</h3>
              <button className={styles.modalCloseBtn} onClick={() => setIsImportModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleConfirmImport} className={styles.modalBody}>
              <label className={styles.inputLabel}>
                项目路径 (支持绝对路径)
                <input
                  type="text"
                  className={styles.textInput}
                  placeholder="/Users/username/Projects/my_project"
                  value={importPath}
                  onChange={(e) => setImportPath(e.target.value)}
                  autoFocus
                  required
                />
              </label>

              <label className={styles.inputLabel}>
                项目别名 (可选)
                <input
                  type="text"
                  className={styles.textInput}
                  placeholder="项目名称（留空自动解析路径最后一级）"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                />
              </label>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setIsImportModalOpen(false)}
                >
                  取消
                </button>
                <button type="submit" className={styles.submitBtn}>
                  确认导入
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 底部账户卡片 */}
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
        <button className={styles.actionIcon} title="帮助与设置" onClick={onOpenSettings}>
          <HelpCircle size={14} />
        </button>
      </div>
    </aside>
  );
};
