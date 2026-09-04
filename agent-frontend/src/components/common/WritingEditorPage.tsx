import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronLeft, NotebookPen } from 'lucide-react';
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

/** 项目唯一的沉浸式长文编辑器，日历手记与资料记录均复用此界面。 */
export function WritingEditorPage({ backLabel, identity, detail, initialTitle = '', initialBody = '',
  bodyPlaceholder = '开始写下今天……', meta, footer, saving = false, error, onBack, onSave }: WritingEditorPageProps) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [localError, setLocalError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const canSave = Boolean(title.trim() || body.trim()) && !saving;

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

  return <main className={styles.workspace}>
    <header className={styles.topBar}>
      <button type="button" className={styles.backButton} onClick={onBack}><ChevronLeft size={17} />{backLabel}</button>
      <div className={styles.pageIdentity}><NotebookPen size={15} /><span>{identity}</span><small>{detail}</small></div>
      <button type="button" className={styles.saveButton} disabled={!canSave} onClick={() => void save()}><Check size={15} />{saving ? '保存中…' : '保存'}</button>
    </header>
    <div className={styles.scrollArea}><article className={styles.editor}>
      {(error || localError) && <div className={styles.saveError} role="alert">{error || localError}</div>}
      <p className={styles.date}>{detail}</p>
      <input className={styles.titleInput} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="标题" aria-label="标题" autoFocus />
      <div className={styles.metaRow}>{meta}<span>{body.length} 字</span></div>
      <textarea ref={bodyRef} className={styles.bodyInput} value={body} onChange={(event) => setBody(event.target.value)} placeholder={bodyPlaceholder} aria-label="正文" />
      {footer}
      <p className={styles.saveHint}>按 ⌘ S 保存</p>
    </article></div>
  </main>;
}
