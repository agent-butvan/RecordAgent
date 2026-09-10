import { useCallback } from 'react';
import { DotsThree } from '@phosphor-icons/react';
import { fetchRecords, fetchRecordTabs } from '../../../services/recordApi';
import { formatLocalDate } from '../../../services/dailyEvents';
import type { RecordEntry } from '../../../types/record';
import { OverviewCard } from '../../common/OverviewCard';
import { useOverviewResource } from './useOverviewResource';
import { overviewRecords } from './overviewData';
import styles from './SessionOverview.module.css';

interface RecordsOverviewCardProps {
  date: string;
  onOpen: (entry?: RecordEntry | null) => void;
}

/** 日期窗口与资料页一致；以资料日期统计今天，以更新时间排列最近整理。 */
export function RecordsOverviewCard({ date, onOpen }: RecordsOverviewCardProps) {
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

  return <>
    <OverviewCard className={styles.recordsSummary} eyebrow="KNOWLEDGE" title="今日资料积累" loading={loading} error={error} onRetry={() => void reload()}
      action={<button type="button" className={styles.moreButton} onClick={() => onOpen(null)} aria-label="写资料" title="写资料"><DotsThree size={18} weight="bold" /></button>}>
      {data && <>
        <div className={styles.metric}><strong>{data.todayCount}</strong><span>篇新增资料</span></div>
        {displayTabs.length > 0 && (
          <div className={styles.chips}>
            {displayTabs.map((tab) => (
              <span className={styles.badge} key={tab.name}>
                {tab.count > 0 ? `${tab.name} ${tab.count}` : tab.name}
              </span>
            ))}
          </div>
        )}
      </>}
    </OverviewCard>

    <OverviewCard className={styles.recordsDetails} eyebrow="LATEST" title="最近整理" loading={loading} error={error} onRetry={() => void reload()}
      action={<button type="button" className={styles.pillButton} onClick={() => onOpen()}>全部资料</button>}>
      {data && (data.recent.length === 0 ? <p className={styles.empty}>还没有资料。记下一个知识点，或今天的新想法。</p>
        : <ul className={styles.rows}>{data.recent.slice(0, 4).map((entry) => <li key={entry.id}><button type="button" className={styles.row} onClick={() => onOpen(entry)}>
          <span className={styles.rowContent}><span className={styles.rowTitle}>{entry.title || entry.contentText.split('\n')[0] || '无标题资料'}</span>
            <small>{data.tabs.find((tab) => tab.id === entry.tabId)?.name || '未分类'} · {entry.recordDate}</small></span>
        </button></li>)}</ul>)}
    </OverviewCard>
  </>;
}
