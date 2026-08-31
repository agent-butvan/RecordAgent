import React, { useCallback, useEffect, useState } from 'react';
import { ChevronRight, File, Folder, FolderOpen, RefreshCw } from 'lucide-react';
import type { FileTreeNode } from '../../types/team';
import { fetchProjectFileTree } from '../../services/fileTreeApi';
import styles from './ProjectFileTree.module.css';

interface ProjectFileTreeProps {
  projectPath: string;
}

interface TreeListProps {
  nodes: FileTreeNode[];
  expanded: Set<string>;
  onToggle: (path: string) => void;
  depth: number;
}

function TreeList({ nodes, expanded, onToggle, depth }: TreeListProps) {
  return (
    <ul className={styles.list} role="group">
      {nodes.map((node) => {
        const isDir = node.type === 'dir';
        const isOpen = isDir && expanded.has(node.path);
        const children = isDir && isOpen && node.children ? node.children : [];

        return (
          <li key={node.path} className={styles.item}>
            {isDir ? (
              <button
                type="button"
                className={styles.row}
                style={{ paddingLeft: `${12 + depth * 14}px` }}
                onClick={() => onToggle(node.path)}
                aria-expanded={isOpen}
              >
                <ChevronRight
                  size={12}
                  className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
                  aria-hidden="true"
                />
                {isOpen ? (
                  <FolderOpen size={13} className={styles.folderIcon} aria-hidden="true" />
                ) : (
                  <Folder size={13} className={styles.folderIcon} aria-hidden="true" />
                )}
                <span className={styles.name}>{node.name}</span>
              </button>
            ) : (
              <div className={styles.row} style={{ paddingLeft: `${28 + depth * 14}px` }}>
                <File size={13} className={styles.fileIcon} aria-hidden="true" />
                <span className={styles.name}>{node.name}</span>
              </div>
            )}
            {children.length > 0 && (
              <TreeList nodes={children} expanded={expanded} onToggle={onToggle} depth={depth + 1} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** 项目文件树：只读展示项目目录结构，支持目录展开/收起与手动刷新。 */
export const ProjectFileTree: React.FC<ProjectFileTreeProps> = ({ projectPath }) => {
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nodes = await fetchProjectFileTree(projectPath);
      setTree(nodes);
      setExpanded(new Set(nodes.filter((node) => node.type === 'dir').map((node) => node.path)));
    } catch (e) {
      setError(e instanceof Error ? e.message : '读取项目文件失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleDir = useCallback((path: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  return (
    <section className={styles.container} aria-label="项目文件树">
      <div className={styles.header}>
        <div className={styles.headerText}>
          <div className={styles.title}>项目文件</div>
          <p className={styles.path} title={projectPath}>{projectPath}</p>
        </div>
        <button
          type="button"
          className={styles.refresh}
          onClick={() => void load()}
          disabled={isLoading}
          aria-label="刷新项目文件树"
          title="刷新"
        >
          <RefreshCw size={14} className={isLoading ? styles.refreshing : ''} aria-hidden="true" />
        </button>
      </div>

      {error ? (
        <div className={styles.error} role="status">
          <p>{error}</p>
          <button type="button" className={styles.retry} onClick={() => void load()}>
            重试
          </button>
        </div>
      ) : isLoading && tree.length === 0 ? (
        <div className={styles.skeleton} aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={styles.skeletonRow} style={{ width: `${78 - i * 7}%` }} />
          ))}
        </div>
      ) : tree.length === 0 ? (
        <p className={styles.empty}>项目目录为空或暂无可展示文件。</p>
      ) : (
        <div className={styles.tree}>
          <TreeList nodes={tree} expanded={expanded} onToggle={toggleDir} depth={0} />
        </div>
      )}
    </section>
  );
};
