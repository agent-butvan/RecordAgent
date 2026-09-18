import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { CaretLeftIcon, CheckIcon, NotePencilIcon } from '@phosphor-icons/react';
import { EditorContent, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import CodeBlock from '@tiptap/extension-code-block';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from '@tiptap/markdown';
import { TiptapCodeBlockView } from '../ui/TiptapCodeBlockView';
import { useMessage } from './Message';
import styles from './WritingEditorPage.module.css';

const CustomCodeBlock = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(TiptapCodeBlockView);
  },
});

interface WritingEditorPageProps {
  backLabel: string;
  identity: string;
  detail: string;
  initialTitle?: string;
  initialBody?: string;
  bodyPlaceholder?: string;
  meta?: ReactNode;
  footer?: ReactNode;
  saving?: boolean;
  onBack: () => void;
  onSave: (value: { title?: string; body: string; html?: string }) => void | Promise<void>;
}

interface EditorHeading {
  id: string;
  level: number;
  label: string;
  pos: number;
}

function extractEditorHeadings(editor: Editor | null): EditorHeading[] {
  if (!editor) return [];
  const items: EditorHeading[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const label = node.textContent.trim();
      if (label) {
        items.push({
          id: `${pos}-${label}`,
          level: (node.attrs.level as number) || 1,
          label,
          pos,
        });
      }
    }
  });
  return items;
}

/** 项目唯一的沉浸式长文编辑器，日历手记与资料记录均复用此界面。支持输入 ## 空格即时渲染为二级标题。 */
export function WritingEditorPage({
  backLabel,
  identity,
  detail,
  initialTitle = '',
  initialBody = '',
  bodyPlaceholder = '开始写下今天……',
  meta,
  footer,
  saving = false,
  onBack,
  onSave,
}: WritingEditorPageProps) {
  const { showMessage } = useMessage();
  const [title, setTitle] = useState(initialTitle);
  const [headings, setHeadings] = useState<EditorHeading[]>([]);
  const [characterCount, setCharacterCount] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
        codeBlock: false,
      }),
      CustomCodeBlock,
      Markdown,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') {
            return `标题 ${node.attrs.level}`;
          }
          return bodyPlaceholder || '输入正文，或按 ## 创建二级标题……';
        },
      }),
    ],
    content: initialBody,
    contentType: 'markdown',
    editorProps: {
      attributes: {
        class: styles.bodyEditor,
      },
    },
    onCreate: ({ editor: ed }) => {
      setHeadings(extractEditorHeadings(ed));
      setCharacterCount(ed.getText().length);
    },
    onUpdate: ({ editor: ed }) => {
      setHeadings(extractEditorHeadings(ed));
      setCharacterCount(ed.getText().length);
    },
  });

  const canSave = Boolean(title.trim() || (editor ? !editor.isEmpty : initialBody.trim())) && !saving;

  const save = useCallback(async () => {
    if (!canSave) return;
    try {
      const markdown = editor ? editor.getMarkdown() : initialBody;
      const html = editor ? editor.getHTML() : '';
      await onSave({ title: title.trim() || undefined, body: markdown.trim(), html });
    } catch (reason) {
      showMessage('error', reason instanceof Error ? reason.message : '保存失败，请重试');
    }
  }, [canSave, editor, initialBody, onSave, showMessage, title]);

  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  }, [save]);

  const locateHeading = (heading: EditorHeading) => {
    if (!editor) return;
    editor.commands.focus(heading.pos);
    const domNode = editor.view.nodeDOM(heading.pos);
    if (domNode instanceof HTMLElement) {
      domNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      const resolved = editor.view.domAtPos(heading.pos);
      const target = resolved.node instanceof HTMLElement ? resolved.node : resolved.node.parentElement;
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLElement>) => {
    if (
      editor &&
      !editor.isFocused &&
      (e.target === e.currentTarget ||
        (e.target as HTMLElement).classList.contains(styles.editorLayout) ||
        (e.target as HTMLElement).classList.contains(styles.editor) ||
        (e.target as HTMLElement).classList.contains(styles.editorWrapper))
    ) {
      editor.commands.focus('end');
    }
  };

  return (
    <main className={styles.workspace}>
      <header className={styles.topBar} data-tauri-drag-region>
        <button type="button" className={styles.backButton} onClick={onBack}>
          <CaretLeftIcon size={17} />
          {backLabel}
        </button>
        <div className={styles.pageIdentity}>
          <NotePencilIcon size={15} />
          <span>{identity}</span>
          <small>{detail}</small>
        </div>
        <button
          type="button"
          className={styles.saveButton}
          disabled={!canSave}
          onClick={() => void save()}
        >
          <CheckIcon size={15} weight="bold" />
          {saving ? '保存中…' : '保存'}
        </button>
      </header>
      <div ref={scrollAreaRef} className={styles.scrollArea} onClick={handleContainerClick}>
        <div className={styles.editorLayout}>
          <article className={styles.editor}>
            <p className={styles.date}>{detail}</p>
            <input
              className={styles.titleInput}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="标题"
              aria-label="标题"
              autoFocus
            />
            <div className={styles.metaRow}>
              {meta}
              <span>{characterCount} 字</span>
            </div>
            <div className={styles.editorWrapper}>
              <EditorContent editor={editor} />
            </div>
            {footer}
            <p className={styles.saveHint}>按 ⌘ S 保存</p>
          </article>
          {headings.length > 0 && (
            <aside className={styles.outline} aria-label="文章目录">
              <strong>目录</strong>
              <nav>
                {headings.map((heading) => (
                  <button
                    key={heading.id}
                    type="button"
                    className={styles[`outlineLevel${heading.level}`]}
                    onClick={() => locateHeading(heading)}
                    title={heading.label}
                  >
                    {heading.label}
                  </button>
                ))}
              </nav>
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}

