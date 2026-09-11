import { BookOpenText, X } from 'lucide-react';
import type { RecordReferenceOption } from '../../types/record';
import { RECORD_REFERENCE_TYPE_LABELS } from './RecordReferencePicker';
import styles from './RecordReferenceChip.module.css';

export function RecordReferenceChip({ reference, onRemove }: {
  reference: RecordReferenceOption;
  onRemove: () => void;
}) {
  return (
    <div className={styles.chip} aria-label={`已引用资料：${reference.title || '无标题资料'}`}>
      <BookOpenText size={16} aria-hidden="true" />
      <span className={styles.content}>
        <span className={styles.title}>{reference.title || '无标题资料'}</span>
        <span className={styles.meta}>{RECORD_REFERENCE_TYPE_LABELS[reference.type]} · {reference.recordDate}</span>
      </span>
      <button type="button" className={styles.remove} onClick={onRemove} aria-label="移除资料引用">
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
