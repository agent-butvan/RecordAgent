import { useEffect, useState, type FormEvent } from 'react';
import { PlayIcon } from '@phosphor-icons/react';
import { Button } from '../common/Button';
import { CategoryPicker } from '../common/CategoryPicker';
import { Modal } from '../common/Modal';
import styles from './StudyStartModal.module.css';

interface StudyStartModalProps {
  open: boolean;
  saving: boolean;
  error?: string | null;
  categories: readonly string[];
  onClose: () => void;
  onStart: (content: string, category: string) => Promise<void>;
}

/** 开始学习前的专注内容与分类表单。 */
export function StudyStartModal({ open, saving, error, categories, onClose, onStart }: StudyStartModalProps) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<string>('项目');

  useEffect(() => {
    if (!open) return;
    setContent('');
    setCategory('项目');
  }, [open]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!content.trim()) return;
    await onStart(content.trim(), category);
  };

  return <Modal open={open} title="开始一段学习" onClose={onClose} width={520} centered>
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <p className={styles.description}>写下这段时间准备做什么，开始后将持续记录学习时长。</p>
      {error && <div className={styles.error} role="alert">{error}</div>}
      <label className={styles.contentField}>
        <span>学习内容</span>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={200}
          placeholder="例如：整理 Spring Boot 自动装配的完整链路"
          required
          autoFocus
        />
      </label>
      <CategoryPicker options={categories} value={category} onChange={setCategory} label="学习分类" disabled={saving} />
      <div className={styles.actions}>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>取消</Button>
        <Button type="submit" variant="primary" icon={<PlayIcon size={14} weight="fill" />}
          disabled={saving || !content.trim() || !category.trim()}>{saving ? '正在开始…' : '开始学习'}</Button>
      </div>
    </form>
  </Modal>;
}
