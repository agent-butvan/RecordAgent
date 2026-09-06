import { TrashIcon } from '@phosphor-icons/react';
import styles from './DailyRecordDeleteButton.module.css';

interface DailyRecordDeleteButtonProps {
  label: string;
  onDelete: () => void;
}

/** 日记录列表统一使用的删除入口。 */
export const DailyRecordDeleteButton: React.FC<DailyRecordDeleteButtonProps> = ({ label, onDelete }) => (
  <button
    type="button"
    className={styles.button}
    onClick={onDelete}
    title={`删除${label}`}
    aria-label={`删除${label}`}
  >
    <TrashIcon size={13} aria-hidden="true" />
  </button>
);
