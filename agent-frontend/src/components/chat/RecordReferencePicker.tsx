import { BookOpenText } from 'lucide-react';
import type { RecordReferenceOption, RecordType } from '../../types/record';
import styles from './RecordReferencePicker.module.css';

interface RecordReferencePickerProps {
  options: RecordReferenceOption[];
  selectedIndex: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  onSelect: (option: RecordReferenceOption) => void;
  onLoadMore: () => void;
}

const TYPE_LABELS: Record<RecordType, string> = {
  quick: '随记',
  learning: '每日学习',
  weekly_review: '每周复盘',
  reading: '读书心得',
  journal: '每日手记',
};

/** `?` 触发的资料引用列表，仅展示后端返回的轻量元数据。 */
export function RecordReferencePicker({
  options, selectedIndex, loading, error, hasMore, loadingMore, onSelect, onLoadMore,
}: RecordReferencePickerProps) {
  return (
    <section className={styles.picker} aria-label="选择引用资料">
      <header className={styles.header}>
        <BookOpenText size={16} aria-hidden="true" />
        <span>引用资料</span>
        <span className={styles.hint}>输入关键词筛选</span>
      </header>
      <div id="record-reference-list" className={styles.list} role="listbox">
        {loading ? <p className={styles.state}>正在读取资料…</p>
          : options.length === 0
            ? error ? <p className={styles.error} role="alert">{error}</p>
              : <p className={styles.state}>没有找到可引用的资料</p>
            : <>
              {options.map((option, index) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={index === selectedIndex}
                  className={`${styles.option} ${index === selectedIndex ? styles.optionSelected : ''}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(option)}
                >
                  <BookOpenText size={16} strokeWidth={1.7} aria-hidden="true" />
                  <span className={styles.content}>
                    <span className={styles.title}>{option.title || '无标题资料'}</span>
                    <span className={styles.summary}>{option.summary || '暂无正文摘要'}</span>
                  </span>
                  <span className={styles.meta}>{TYPE_LABELS[option.type]} · {option.recordDate}</span>
                </button>
              ))}
              {error && <p className={styles.error} role="alert">{error}</p>}
              {hasMore && (
                <button type="button" className={styles.loadMore} onClick={onLoadMore} disabled={loadingMore}>
                  {loadingMore ? '正在加载…' : '加载更多资料'}
                </button>
              )}
            </>}
      </div>
    </section>
  );
}

export { TYPE_LABELS as RECORD_REFERENCE_TYPE_LABELS };
