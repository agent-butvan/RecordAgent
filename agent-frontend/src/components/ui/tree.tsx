import {
  createContext,
  type HTMLAttributes,
  type ReactNode,
  useCallback,
  useContext,
  useId,
  useState,
} from 'react';
import { ChevronRight, File, Folder, FolderOpen } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import styles from './tree.module.css';

interface TreeContextValue {
  expandedIds: Set<string>;
  selectedIds: string[];
  toggleExpanded: (nodeId: string) => void;
  handleSelection: (nodeId: string, additive: boolean) => void;
  showLines: boolean;
  showIcons: boolean;
  selectable: boolean;
  multiSelect: boolean;
  indent: number;
  animateExpand: boolean;
}

const TreeContext = createContext<TreeContextValue | null>(null);

function useTree(): TreeContextValue {
  const context = useContext(TreeContext);
  if (!context) throw new Error('Tree 组件必须在 TreeProvider 内使用');
  return context;
}

interface TreeNodeContextValue {
  nodeId: string;
  level: number;
  isLast: boolean;
  parentPath: boolean[];
  hasChildren: boolean;
}

const TreeNodeContext = createContext<TreeNodeContextValue | null>(null);

function useTreeNode(): TreeNodeContextValue {
  const context = useContext(TreeNodeContext);
  if (!context) throw new Error('TreeNode 子组件必须在 TreeNode 内使用');
  return context;
}

export interface TreeProviderProps {
  children: ReactNode;
  defaultExpandedIds?: string[];
  showLines?: boolean;
  showIcons?: boolean;
  selectable?: boolean;
  multiSelect?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  indent?: number;
  animateExpand?: boolean;
  className?: string;
}

/** 为一棵树统一管理展开、选择和动效偏好。 */
export function TreeProvider({
  children,
  defaultExpandedIds = [],
  showLines = true,
  showIcons = true,
  selectable = true,
  multiSelect = false,
  selectedIds,
  onSelectionChange,
  indent = 18,
  animateExpand = true,
  className,
}: TreeProviderProps) {
  const reduceMotion = useReducedMotion();
  const [expandedIds, setExpandedIds] = useState(() => new Set(defaultExpandedIds));
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>(selectedIds ?? []);
  const controlledSelection = selectedIds !== undefined && onSelectionChange !== undefined;
  const currentSelectedIds = controlledSelection ? selectedIds! : internalSelectedIds;

  const toggleExpanded = useCallback((nodeId: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const handleSelection = useCallback((nodeId: string, additive: boolean) => {
    if (!selectable) return;
    const next = multiSelect && additive
      ? currentSelectedIds.includes(nodeId)
        ? currentSelectedIds.filter((id) => id !== nodeId)
        : [...currentSelectedIds, nodeId]
      : [nodeId];
    if (!controlledSelection) setInternalSelectedIds(next);
    onSelectionChange?.(next);
  }, [controlledSelection, currentSelectedIds, multiSelect, onSelectionChange, selectable]);

  return (
    <TreeContext.Provider value={{
      expandedIds,
      selectedIds: currentSelectedIds,
      toggleExpanded,
      handleSelection,
      showLines,
      showIcons,
      selectable,
      multiSelect,
      indent,
      animateExpand: animateExpand && !reduceMotion,
    }}>
      <motion.div
        className={clsx(styles.provider, className)}
        initial={reduceMotion ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </TreeContext.Provider>
  );
}

export type TreeViewProps = HTMLAttributes<HTMLDivElement>;

export function TreeView({ className, children, ...props }: TreeViewProps) {
  return (
    <div className={clsx(styles.view, className)} role="tree" {...props}>
      {children}
    </div>
  );
}

export interface TreeNodeProps extends HTMLAttributes<HTMLDivElement> {
  nodeId?: string;
  level?: number;
  isLast?: boolean;
  parentPath?: boolean[];
  hasChildren?: boolean;
}

export function TreeNode({
  nodeId: providedNodeId,
  level = 0,
  isLast = false,
  parentPath = [],
  hasChildren = false,
  children,
  className,
  ...props
}: TreeNodeProps) {
  const generatedId = useId();
  const nodeId = providedNodeId ?? generatedId;
  const { expandedIds, selectedIds } = useTree();

  return (
    <TreeNodeContext.Provider value={{ nodeId, level, isLast, parentPath, hasChildren }}>
      <div
        className={clsx(styles.node, className)}
        role="treeitem"
        aria-level={level + 1}
        aria-selected={selectedIds.includes(nodeId)}
        aria-expanded={hasChildren ? expandedIds.has(nodeId) : undefined}
        {...props}
      >
        {children}
      </div>
    </TreeNodeContext.Provider>
  );
}

export interface TreeNodeTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function TreeNodeTrigger({ children, className, onClick, style, ...props }: TreeNodeTriggerProps) {
  const { selectedIds, toggleExpanded, handleSelection, indent, multiSelect } = useTree();
  const { nodeId, level, hasChildren } = useTreeNode();
  const selected = selectedIds.includes(nodeId);

  return (
    <button
      type="button"
      className={clsx(styles.trigger, selected && styles.selected, className)}
      style={{ paddingLeft: 8 + level * indent, ...style }}
      aria-current={selected ? 'true' : undefined}
      onClick={(event) => {
        if (hasChildren) toggleExpanded(nodeId);
        handleSelection(nodeId, multiSelect && (event.ctrlKey || event.metaKey));
        onClick?.(event);
      }}
      {...props}
    >
      <TreeLines />
      {children}
    </button>
  );
}

function TreeLines() {
  const { showLines, indent } = useTree();
  const { level, isLast, parentPath } = useTreeNode();
  if (!showLines || level === 0) return null;

  return (
    <span className={styles.lines} aria-hidden="true">
      {parentPath.slice(0, -1).map((parentIsLast, index) => !parentIsLast && (
        <span
          className={styles.ancestorLine}
          key={index}
          style={{ left: 15 + index * indent }}
        />
      ))}
      <span
        className={clsx(styles.branchLine, isLast && styles.branchLineLast)}
        style={{ left: 15 + (level - 1) * indent, width: indent - 6 }}
      />
    </span>
  );
}

export interface TreeNodeContentProps {
  children: ReactNode;
  className?: string;
}

export function TreeNodeContent({ children, className }: TreeNodeContentProps) {
  const { animateExpand, expandedIds } = useTree();
  const { nodeId, hasChildren } = useTreeNode();
  const expanded = expandedIds.has(nodeId);

  return (
    <AnimatePresence initial={false}>
      {hasChildren && expanded && (
        <motion.div
          className={clsx(styles.content, className)}
          role="group"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: animateExpand ? 0.16 : 0, ease: 'easeInOut' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function TreeExpander() {
  const { expandedIds } = useTree();
  const { nodeId, hasChildren } = useTreeNode();
  return (
    <span className={styles.expander} aria-hidden="true">
      {hasChildren && (
        <ChevronRight
          size={13}
          className={clsx(styles.chevron, expandedIds.has(nodeId) && styles.chevronOpen)}
        />
      )}
    </span>
  );
}

export interface TreeIconProps {
  kind?: 'file' | 'folder';
  icon?: ReactNode;
  className?: string;
}

export function TreeIcon({ kind = 'file', icon, className }: TreeIconProps) {
  const { showIcons, expandedIds } = useTree();
  const { nodeId } = useTreeNode();
  if (!showIcons) return null;
  const defaultIcon = kind === 'folder'
    ? expandedIds.has(nodeId) ? <FolderOpen size={15} /> : <Folder size={15} />
    : <File size={15} />;
  return <span className={clsx(styles.icon, kind === 'folder' && styles.folderIcon, className)} aria-hidden="true">{icon ?? defaultIcon}</span>;
}

export type TreeLabelProps = HTMLAttributes<HTMLSpanElement>;

export function TreeLabel({ className, ...props }: TreeLabelProps) {
  return <span className={clsx(styles.label, className)} {...props} />;
}
