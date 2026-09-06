import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CaretLeftIcon, CheckIcon, NotePencilIcon } from '@phosphor-icons/react';
import styles from './WritingEditorPage.module.css';

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
  error?: string | null;
  onBack: () => void;
  onSave: (value: { title?: string; body: string }) => void | Promise<void>;
}

interface EditorHeading {
  level: number;
  label: string;
  offset: number;
  line: number;
}

function extractHeadings(body: string): EditorHeading[] {
  const headings: EditorHeading[] = [];
  let offset = 0;
  body.split('\n').forEach((line, index) => {
    const match = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (match) headings.push({ level: match[1].length, label: match[2], offset, line: index });
    offset += line.length + 1;
  });
  return headings;
}

/** 项目唯一的沉浸式长文编辑器，日历手记与资料记录均复用此界面。 */
export function WritingEditorPage({ backLabel, identity, detail, initialTitle = '', initialBody = '',
  bodyPlaceholder = '开始写下今天……', meta, footer, saving = false, error, onBack, onSave }: WritingEditorPageProps) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [localError, setLocalError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const canSave = Boolean(title.trim() || body.trim()) && !saving;
  const headings = useMemo(() => extractHeadings(body), [body]);

  useEffect(() => {
    const textarea = bodyRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(textarea.scrollHeight, 360)}px`;
  }, [body]);

  const save = useCallback(async () => {
    if (!canSave) return;
    setLocalError(null);
    try { await onSave({ title: title.trim() || undefined, body: body.trim() }); }
    catch (reason) { setLocalError(reason instanceof Error ? reason.message : '保存失败，请重试'); }
  }, [body, canSave, onSave, title]);

  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void save(); }
    };
    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  }, [save]);

  const locateHeading = (heading: EditorHeading) => {
    const textarea = bodyRef.current;
    const scrollArea = scrollAreaRef.current;
    if (!textarea || !scrollArea) return;
    textarea.focus();
    textarea.setSelectionRange(heading.offset, heading.offset);
    const lineHeight = Number.parseFloat(window.getComputedStyle(textarea).lineHeight) || 28;
    const targetTop = textarea.offsetTop + heading.line * lineHeight - scrollArea.clientHeight * 0.22;
    scrollArea.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
  };

  return <main className={styles.workspace}>
    <header className={styles.topBar}>
      <button type="button" className={styles.backButton} onClick={onBack}><CaretLeftIcon size={17} />{backLabel}</button>
      <div className={styles.pageIdentity}><NotePencilIcon size={15} /><span>{identity}</span><small>{detail}</small></div>
      <button type="button" className={styles.saveButton} disabled={!canSave} onClick={() => void save()}><CheckIcon size={15} weight="bold" />{saving ? '保存中…' : '保存'}</button>
    </header>
    <div ref={scrollAreaRef} className={styles.scrollArea}><div className={styles.editorLayout}><article className={styles.editor}>
        {(error || localError) && <div className={styles.saveError} role="alert">{error || localError}</div>}
        <p className={styles.date}>{detail}</p>
        <input className={styles.titleInput} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="标题" aria-label="标题" autoFocus />
        <div className={styles.metaRow}>{meta}<span>{body.length} 字</span></div>
        <textarea ref={bodyRef} className={styles.bodyInput} value={body} onChange={(event) => setBody(event.target.value)} placeholder={bodyPlaceholder} aria-label="正文" />
        {footer}
        <p className={styles.saveHint}>按 ⌘ S 保存</p>
      </article>
      {headings.length > 0 && <aside className={styles.outline} aria-label="文章目录">
        <strong>目录</strong>
        <nav>{headings.map((heading) => <button key={`${heading.offset}-${heading.label}`} type="button"
          className={styles[`outlineLevel${heading.level}`]} onClick={() => locateHeading(heading)} title={heading.label}>{heading.label}</button>)}</nav>
      </aside>}
    </div></div>
  </main>;
}
