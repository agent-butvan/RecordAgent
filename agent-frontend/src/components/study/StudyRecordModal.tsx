import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { SaveStudySessionInput, StudySession } from '../../types/study';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { STUDY_CATEGORIES } from './studyCategories';
import styles from './StudyRecordModal.module.css';

interface StudyRecordModalProps {
  open: boolean;
  session?: StudySession | null;
  saving: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (input: SaveStudySessionInput) => Promise<void>;
}

function toLocalInput(instant?: string | null, fallbackOffsetHours = 0): string {
  const date = instant ? new Date(instant) : new Date(Date.now() + fallbackOffsetHours * 3_600_000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/** 补卡与已完成记录编辑共用的受控表单。 */
export function StudyRecordModal({ open, session, saving, error, onClose, onSave }: StudyRecordModalProps) {
  const defaults = useMemo(() => ({
    content: session?.content ?? '',
    category: session?.category ?? '项目',
    location: session?.location ?? '',
    startedAt: toLocalInput(session?.startedAt, -1),
    endedAt: toLocalInput(session?.endedAt),
  }), [session]);
  const [content, setContent] = useState(defaults.content);
  const [location, setLocation] = useState(defaults.location);
  const [category, setCategory] = useState(defaults.category);
  const [startedAt, setStartedAt] = useState(defaults.startedAt);
  const [endedAt, setEndedAt] = useState(defaults.endedAt);

  useEffect(() => {
    if (!open) return;
    setContent(defaults.content);
    setLocation(defaults.location);
    setCategory(defaults.category);
    setStartedAt(defaults.startedAt);
    setEndedAt(defaults.endedAt);
  }, [defaults, open]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSave({
      content: content.trim(),
      category,
      location: location.trim() || null,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  };

  const categories = STUDY_CATEGORIES.includes(category as typeof STUDY_CATEGORIES[number])
    ? STUDY_CATEGORIES
    : [category, ...STUDY_CATEGORIES];

  return <Modal open={open} title={session ? '编辑学习记录' : '补一段学习记录'} onClose={onClose} width={480} centered>
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <p className={styles.description}>时间按当前设备时区保存，学习时长将由系统自动计算。</p>
      {error && <div className={styles.error} role="alert">{error}</div>}
      <label>
        <span>学习内容</span>
        <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={200}
          placeholder="例如：复习 Java 并发八股文" required autoFocus />
      </label>
      <label>
        <span>学习分类</span>
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <div className={styles.timeFields}>
        <label><span>开始时间</span><input type="datetime-local" value={startedAt}
          onChange={(event) => setStartedAt(event.target.value)} required /></label>
        <label><span>结束时间</span><input type="datetime-local" value={endedAt}
          min={startedAt} onChange={(event) => setEndedAt(event.target.value)} required /></label>
      </div>
      <label><span>地点（可选）</span><input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={200} placeholder="例如：学校图书馆" /></label>
      <div className={styles.actions}>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>取消</Button>
        <Button type="submit" variant="primary" disabled={saving || !content.trim() || !startedAt || !endedAt}>
          {saving ? '保存中…' : session ? '保存修改' : '完成补卡'}
        </Button>
      </div>
    </form>
  </Modal>;
}
