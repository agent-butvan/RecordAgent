import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, NotebookPen } from 'lucide-react';
import type { CalendarJournal } from '../../types/calendar';
import styles from './JournalEditorPage.module.css';

interface JournalEditorPageProps {
  date: Date;
  initialJournal?: CalendarJournal;
  onBack: () => void;
  onSave: (journal: CalendarJournal) => void;
  error?: string | null;
}

const WEEKDAY_FULL = '日一二三四五六';

/** 独立手记编辑页：为当天提供无干扰的长文写作体验。 */
export const JournalEditorPage: React.FC<JournalEditorPageProps> = ({ date, initialJournal, onBack, onSave, error }) => {
  const [title, setTitle] = useState(initialJournal?.title ?? '');
  const [body, setBody] = useState(initialJournal?.excerpt ?? '');
  const [mood, setMood] = useState(initialJournal?.mood ?? '');
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const canSave = Boolean(title.trim() || body.trim());
  const dateLabel = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 星期${WEEKDAY_FULL[date.getDay()]}`;

  useEffect(() => {
    const textarea = bodyRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(textarea.scrollHeight, 360)}px`;
  }, [body]);

  const save = useCallback(() => {
    if (!canSave) return;
    onSave({
      title: title.trim() || undefined,
      excerpt: body.trim(),
      mood: mood.trim() || '未标注心情',
      updatedAt: new Date().toISOString(),
    });
  }, [body, canSave, mood, onSave, title]);

  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  }, [save]);

  return (
    <main className={styles.workspace}>
      <header className={styles.topBar}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          <ChevronLeft size={17} aria-hidden="true" />
          日历
        </button>
        <div className={styles.pageIdentity}>
          <NotebookPen size={15} aria-hidden="true" />
          <span>手记</span>
          <small>{dateLabel}</small>
        </div>
        <button type="button" className={styles.saveButton} disabled={!canSave} onClick={save}>
          <Check size={15} aria-hidden="true" />
          保存
        </button>
      </header>

      <div className={styles.scrollArea}>
        <article className={styles.editor}>
          {error && <div className={styles.saveError} role="alert">{error}</div>}
          <p className={styles.date}>{dateLabel}</p>
          <input
            className={styles.titleInput}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="标题"
            aria-label="手记标题"
            autoFocus
          />

          <div className={styles.metaRow}>
            <input
              className={styles.moodInput}
              value={mood}
              onChange={(event) => setMood(event.target.value)}
              placeholder="记录此刻的心情"
              aria-label="此刻的心情"
            />
            <span>{body.length} 字</span>
          </div>

          <textarea
            ref={bodyRef}
            className={styles.bodyInput}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="开始写下今天……"
            aria-label="手记正文"
          />
          <p className={styles.saveHint}>按 ⌘ S 保存并返回日历</p>
        </article>
      </div>
    </main>
  );
};

export default JournalEditorPage;
