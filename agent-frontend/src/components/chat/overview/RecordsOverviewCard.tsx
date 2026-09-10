import { useCallback } from 'react';
import { DotsThree } from '@phosphor-icons/react';
import { fetchRecords, fetchRecordTabs } from '../../../services/recordApi';
import { formatLocalDate } from '../../../services/dailyEvents';
import type { RecordEntry } from '../../../types/record';
import { useOverviewResource } from './useOverviewResource';
import { overviewRecords } from './overviewData';
import styles from './SessionOverview.module.css';

export interface RecordsTilesProps {
  date: string;
  onOpen: (entry?: RecordEntry | null) => void;
}

export function DocsTile({ date, onOpen }: RecordsTilesProps) {
  const load = useCallback(async () => {
    const from = new Date(`${date}T12:00:00`);
    const to = new Date(from);
    from.setFullYear(from.getFullYear() - 1);
    to.setFullYear(to.getFullYear() + 1);
    const [records, tabs] = await Promise.all([fetchRecords(formatLocalDate(from), formatLocalDate(to)), fetchRecordTabs()]);
    return { ...overviewRecords(records, date), tabs };
  }, [date]);
  const { data, loading, error, reload } = useOverviewResource(load);

  const activeTabsWithCount = data ? data.tabs.map((tab) => {
    const count = data.recent.filter((entry) => entry.tabId === tab.id && entry.recordDate === date).length;
    return { name: tab.name, count };
  }).filter((t) => t.count > 0).slice(0, 3) : [];

  const fallbackTabs = data && activeTabsWithCount.length === 0 ? data.tabs.slice(0, 2).map((t) => ({ name: t.name, count: 0 })) : [];
  const displayTabs = activeTabsWithCount.length > 0 ? activeTabsWithCount : fallbackTabs;

  return (
    <section className={`${styles.tile} ${styles.docs}`}>
      <div className={styles.tileHead}>
        <div>
          <div className={styles.eyebrow}>KNOWLEDGE</div>
          <div className={styles.title}>今日资料积累</div>
        </div>
        <button type="button" className={styles.more} onClick={() => onOpen(null)} aria-label="写资料" title="写资料">
          <DotsThree size={18} weight="bold" />
        </button>
      </div>

      {loading ? (
        <p className={styles.empty}>正在加载资料…</p>
      ) : error ? (
        <p className={styles.error} onClick={() => void reload()}>{error}</p>
      ) : data ? (
        <>
          <div className={styles.docCount}>
            <b>{data.todayCount}</b>
            <span>篇新增资料</span>
          </div>
          {displayTabs.length > 0 && (
            <div className={styles.docChips}>
              {displayTabs.map((tab) => (
                <span className={styles.docChip} key={tab.name}>
                  {tab.name}{tab.count > 0 ? ` ${tab.count}` : ''}
                </span>
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

export function DocsListTile({ date, onOpen }: RecordsTilesProps) {
  const load = useCallback(async () => {
    const from = new Date(`${date}T12:00:00`);
    const to = new Date(from);
    from.setFullYear(from.getFullYear() - 1);
    to.setFullYear(to.getFullYear() + 1);
    const [records, tabs] = await Promise.all([fetchRecords(formatLocalDate(from), formatLocalDate(to)), fetchRecordTabs()]);
    return { ...overviewRecords(records, date), tabs };
  }, [date]);
  const { data, loading, error, reload } = useOverviewResource(load);

  return (
    <section className={`${styles.tile} ${styles.docsList}`}>
      <div className={styles.tileHead} style={{ marginBottom: 2 }}>
        <div>
          <div className={styles.eyebrow}>LATEST</div>
          <div className={styles.title}>最近整理</div>
        </div>
        <span className={styles.pill} onClick={() => onOpen()}>全部资料</span>
      </div>

      {loading ? (
        <p className={styles.empty}>正在加载整理记录…</p>
      ) : error ? (
        <p className={styles.error} onClick={() => void reload()}>{error}</p>
      ) : data && data.recent.length === 0 ? (
        <p className={styles.empty}>暂无资料。</p>
      ) : data ? (
        data.recent.slice(0, 3).map((entry) => (
          <button
            type="button"
            key={entry.id}
            className={styles.docRow}
            onClick={() => onOpen(entry)}
          >
            <div className={styles.docTitle}>
              {entry.title || entry.contentText.split('\n')[0] || '无标题资料'}
            </div>
            <div className={styles.docMeta}>
              <span>{data.tabs.find((tab) => tab.id === entry.tabId)?.name || '未分类'}</span>
              <span>{entry.recordDate}</span>
            </div>
          </button>
        ))
      ) : null}
    </section>
  );
}

export function RecordsOverviewCard(props: RecordsTilesProps) {
  return (
    <>
      <DocsTile date={props.date} onOpen={props.onOpen} />
      <DocsListTile date={props.date} onOpen={props.onOpen} />
    </>
  );
}
