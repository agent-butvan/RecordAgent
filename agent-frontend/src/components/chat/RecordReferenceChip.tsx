import { X } from 'lucide-react';
import type { CSSProperties } from 'react';
import { RECORD_REFERENCE_PRESENTATIONS } from '../../features/record/recordReferencePresentation';
import type { RecordReferenceOption } from '../../types/record';
import { RecordReferenceIcon } from './RecordReferenceIcon';
import styles from './RecordReferenceChip.module.css';

export function RecordReferenceChip({ reference, onRemove }: {
  reference: RecordReferenceOption;
  onRemove: () => void;
}) {
  const presentation = RECORD_REFERENCE_PRESENTATIONS[reference.type];
  return (
    <div
      className={styles.chip}
      aria-label={`已引用资料：${reference.title || '无标题资料'}`}
      style={{
        '--reference-color': presentation.color,
        '--reference-border': presentation.borderColor,
        '--reference-background': presentation.backgroundColor,
      } as CSSProperties}
    >
      <RecordReferenceIcon icon={presentation.icon} size={16} />
      <span className={styles.content}>
        <span className={styles.title}>{reference.title || '无标题资料'}</span>
        <span className={styles.meta}>{presentation.label} · {reference.recordDate}</span>
      </span>
      <button type="button" className={styles.remove} onClick={onRemove} aria-label="移除资料引用">
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
