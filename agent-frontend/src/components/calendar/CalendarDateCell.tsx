import type { DailyDaySummary } from '../../types/dailyEvent';
import { calendarCellItems } from '../../features/calendar/calendarItems';
import { formatStudyDuration } from './calendarPresentation';
import styles from './CalendarDateCell.module.css';

interface Props {
  date: Date;
  dateKey: string;
  inMonth: boolean;
  today: boolean;
  selected: boolean;
  available: boolean;
  previewOpen: boolean;
  summary?: DailyDaySummary;
  studySeconds?: number;
  recordCount?: number;
  onSelect: () => void;
  onPreview: (anchor: HTMLButtonElement, immediate: boolean) => void;
  onLeave: () => void;
}
/** 白底日期格展示简短事项标题，以低饱和色条区分来源。 */
export function CalendarDateCell({
  date,
  dateKey,
  inMonth,
  today,
  selected,
  available,
  previewOpen,
  summary,
  studySeconds = 0,
  recordCount = 0,
  onSelect,
  onPreview,
  onLeave,
}: Props) {
  const items = calendarCellItems(
    summary,
    studySeconds > 0 ? formatStudyDuration(studySeconds) : null,
    recordCount,
  );
  const visibleItems = items.slice(0, 3);
  const hasMore =
    items.length > 3 ||
    ((summary?.eventCount ?? 0) > (summary?.items?.length ?? 0) &&
      items.length >= 3);
  return (
    <button
      type="button"
      className={[
        styles.cell,
        !inMonth ? styles.outside : '',
        selected ? styles.selected : '',
      ].join(' ')}
      onMouseEnter={(event) => onPreview(event.currentTarget, false)}
      onMouseLeave={onLeave}
      onFocus={(event) => {
        if (event.currentTarget.matches(':focus-visible'))
          onPreview(event.currentTarget, true);
      }}
      onBlur={onLeave}
      onClick={onSelect}
      aria-pressed={selected}
      aria-current={today ? 'date' : undefined}
      aria-expanded={previewOpen}
      aria-controls={previewOpen ? 'calendar-day-preview' : undefined}
      aria-label={`${dateKey}，${items.map((item) => item.title).join('，') || '暂无事项'}${!available ? '，部分摘要暂不可用' : ''}`}
    >
      <span className={`${styles.number} ${today ? styles.today : ''}`}>
        {date.getDate()}
      </span>
      {inMonth && (
        <span className={styles.items}>
          {visibleItems.map((item) => (
            <span
              key={item.id}
              className={`${styles.item} ${styles[item.tone]}`}
            >
              {item.title}
            </span>
          ))}
          {hasMore && <span className={styles.more}>更多事项…</span>}
          {!available && <span className={styles.more}>部分摘要暂不可用</span>}
        </span>
      )}
    </button>
  );
}
