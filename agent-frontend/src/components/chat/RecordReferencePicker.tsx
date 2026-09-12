import { BookOpenText } from 'lucide-react';
import type { CSSProperties } from 'react';
import { RECORD_REFERENCE_PRESENTATIONS } from '../../features/record/recordReferencePresentation';
import type { RecordReferenceOption } from '../../types/record';
import { RecordReferenceIcon } from './RecordReferenceIcon';
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

/** `?` 触发的资料引用列表，仅展示后端返回的轻量元数据。 */
export function RecordReferencePicker({
  options, selectedIndex, loading, error, hasMore, loadingMore, onSelect, onLoadMore,
}: RecordReferencePickerProps) {
  return (
    <section className={styles.picker} aria-label="选择引用资料">
      <header className={styles.header}>
        <BookOpenText size={14} strokeWidth={1.6} aria-hidden="true" />
        <span>引用资料</span>
        <span className={styles.hint}>输入关键词筛选</span>
      </header>
      <div id="record-reference-list" className={styles.list} role="listbox">
        {loading ? <p className={styles.state}>正在读取资料…</p>
          : options.length === 0
            ? error ? <p className={styles.error} role="alert">{error}</p>
              : <p className={styles.state}>没有找到可引用的资料</p>
            : <>
              {options.map((option, index) => {
                const presentation = RECORD_REFERENCE_PRESENTATIONS[option.type];
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={index === selectedIndex}
                    className={`${styles.option} ${index === selectedIndex ? styles.optionSelected : ''}`}
                    style={{ '--reference-color': presentation.color } as CSSProperties}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onSelect(option)}
                  >
                    <span className={styles.optionIcon}>
                      <RecordReferenceIcon icon={presentation.icon} size={14} />
                    </span>
                    <span className={styles.content}>
                      <span className={styles.title}>{option.title || '无标题资料'}</span>
                      <span className={styles.summary}>{option.summary || '暂无正文摘要'}</span>
                    </span>
                    <span className={styles.meta}>{presentation.label} · {option.recordDate}</span>
                  </button>
                );
              })}
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
