import type { CSSProperties } from 'react';
import {
  GENERIC_RECORD_REFERENCE_PRESENTATION,
  type RecordReferencePresentation,
} from '../../features/record/recordReferencePresentation';
import { RecordReferenceIcon } from './RecordReferenceIcon';
import styles from './RecordReferenceTag.module.css';

export function RecordReferenceTag({
  title,
  presentation = GENERIC_RECORD_REFERENCE_PRESENTATION,
}: {
  title: string;
  presentation?: RecordReferencePresentation;
}) {
  return (
    <span
      className={styles.tag}
      aria-label={`${presentation.label}：${title}`}
      style={{
        '--reference-color': presentation.color,
        '--reference-border': presentation.borderColor,
        '--reference-background': presentation.backgroundColor,
      } as CSSProperties}
    >
      <RecordReferenceIcon icon={presentation.icon} size={14} />
      <span>{title}</span>
    </span>
  );
}
