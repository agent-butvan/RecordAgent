import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import type { ChatSession, Project } from '../../types/chat';
import { UserPopover } from '../common/UserPopover';
import { FormField } from '../common/FormField';
import { TextInput } from '../common/TextInput';
import { Modal } from '../common/Modal';
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
  onUpdateSessionTitle?: (id: string, newTitle: string) => void;
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
  onUpdateSessionTitle,
  onOpenSettings,
}) => {
  const [isUserPopoverOpen, setIsUserPopoverOpen] = useState(false);

  // 双击修改会话标题状态
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // 区分项目与最近组的展开/收起折叠状态
  const [isProjectsSectionExpanded, setIsProjectsSectionExpanded] = useState(true);
  const [isRecentSectionExpanded, setIsRecentSectionExpanded] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPath, setImportPath] = useState('');
  const [importName, setImportName] = useState('');

  // Esc 关闭弹窗与用户菜单
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsImportModalOpen(false);
        setIsUserPopoverOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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
        {/* 1. 项目大类 */}
        <div className={styles.sectionGroup}>
          <div className={styles.groupHeader}>
            <div
              className={styles.groupTitleClickable}
              onClick={() => setIsProjectsSectionExpanded(!isProjectsSectionExpanded)}
            >
              <span className={styles.groupTitle}>项目</span>
              {isProjectsSectionExpanded ? (
                <ChevronDown size={14} className={styles.arrowIcon} />
              ) : (
                <ChevronRight size={14} className={styles.arrowIcon} />
              )}
            </div>
            <button
              className={styles.iconBtnSmall}
              title="导入本地项目"
              aria-label="导入本地项目"
              onClick={() => setIsImportModalOpen(true)}
            >
              <FolderPlus size={14} />
            </button>
          </div>

          {isProjectsSectionExpanded && (
            <div className={styles.sectionContent}>
              {projects.length === 0 ? (
                <div className={styles.emptyLinkRow} onClick={() => setIsImportModalOpen(true)}>
                  <span>+ 点击导入项目</span>
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
                            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            <Folder size={13} style={{ color: '#2563eb', marginLeft: '2px' }} />
                            <span className={styles.projectName} title={project.path}>{project.name}</span>
                          </div>
                          <button
                            className={styles.iconBtnSmall}
                            title="在此项目下新建会话"
                            aria-label="在此项目下新建会话"
                            onClick={() => onNewProjectChat(project.id)}
                          >
                            <Plus size={13} />
                          </button>
                        </div>

                        {isExpanded && (
                          <div className={styles.projectSubSessions}>
                            {projectSessions.map((session) => {
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
                                    aria-label="删除会话"
                                    onClick={(e) => onDeleteSession(session.id, e)}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. 最近 / 普通会话大类 */}
        <div className={styles.sectionGroup}>
          <div className={styles.groupHeader}>
            <div
              className={styles.groupTitleClickable}
              onClick={() => setIsRecentSectionExpanded(!isRecentSectionExpanded)}
            >
              <span className={styles.groupTitle}>最近</span>
              {isRecentSectionExpanded ? (
                <ChevronDown size={14} className={styles.arrowIcon} />
              ) : (
                <ChevronRight size={14} className={styles.arrowIcon} />
              )}
            </div>
            <div className={styles.groupActions}>
              <button
                className={styles.iconBtnSmall}
                title="新建普通对话"
                aria-label="新建普通对话"
                onClick={onNewGeneralChat}
              >
                <SquarePen size={14} />
              </button>
            </div>
          </div>

          {isRecentSectionExpanded && (
            <div className={styles.sectionContent}>
              <div className={styles.sessionList}>
                {generalSessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  const isEditing = editingSessionId === session.id;

                  return (
                    <div
                      key={session.id}
                      className={`${styles.sessionItem} ${isActive ? styles.sessionActive : ''}`}
                      onClick={() => !isEditing && onSelectSession(session.id)}
                    >
                      <MessageSquare size={13} style={{ opacity: 0.6, flexShrink: 0 }} />
                      {isEditing ? (
                        <input
                          type="text"
                          className={styles.sessionTitleInput || styles.textInput}
                          style={{
                            height: '24px',
                            fontSize: '12px',
                            padding: '0 6px',
                            width: '100%',
                            background: '#ffffff',
                            border: '1px solid #3b82f6',
                            borderRadius: '4px',
                          }}
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.stopPropagation();
                              if (editingTitle.trim() && onUpdateSessionTitle) {
                                onUpdateSessionTitle(session.id, editingTitle.trim());
                              }
                              setEditingSessionId(null);
                            } else if (e.key === 'Escape') {
                              setEditingSessionId(null);
                            }
                          }}
                          onBlur={() => {
                            if (editingTitle.trim() && onUpdateSessionTitle && editingTitle !== session.title) {
                              onUpdateSessionTitle(session.id, editingTitle.trim());
                            }
                            setEditingSessionId(null);
                          }}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className={styles.sessionTitle}
                          title={`${session.title || '新对话'}（双击修改标题）`}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingSessionId(session.id);
                            setEditingTitle(session.title || '');
                          }}
                        >
                          {session.title || '新对话'}
                        </span>
                      )}
                      <button
                        className={styles.deleteBtn}
                        title="删除会话"
                        aria-label="删除会话"
                        onClick={(e) => onDeleteSession(session.id, e)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 导入项目 UI 弹窗 */}
      <Modal
        open={isImportModalOpen}
        title="导入本地项目"
        onClose={() => setIsImportModalOpen(false)}
      >
        <form onSubmit={handleConfirmImport} className={styles.modalBody}>
          <FormField label="项目路径 (支持绝对路径)" htmlFor="import-path" required>
            <TextInput
              id="import-path"
              placeholder="/Users/username/Projects/my_project"
              value={importPath}
              onChange={(e) => setImportPath(e.target.value)}
              autoFocus
              required
            />
          </FormField>

          <FormField label="项目别名 (可选)" htmlFor="import-name">
            <TextInput
              id="import-name"
              placeholder="项目名称（留空自动解析路径最后一级）"
              value={importName}
              onChange={(e) => setImportName(e.target.value)}
            />
          </FormField>

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
      </Modal>

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
          aria-label="打开用户菜单"
        >
          <div className={styles.avatarCircle}>BA</div>
          <span className={styles.userName}>ButvanAgent</span>
        </div>
        <button className={styles.actionIcon} title="帮助与设置" aria-label="帮助与设置" onClick={onOpenSettings}>
          <HelpCircle size={14} />
        </button>
      </div>
    </aside>
  );
};
