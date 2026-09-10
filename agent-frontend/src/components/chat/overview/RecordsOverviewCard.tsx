import { useCallback } from 'react';
import { fetchRecords, fetchRecordTabs } from '../../../services/recordApi';
import { formatLocalDate } from '../../../services/dailyEvents';
import type { RecordEntry } from '../../../types/record';
import { OverviewCard } from '../../common/OverviewCard';
import { Button } from '../../common/Button';
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
  return <OverviewCard title="资料积累" description="把今天的收获留住" loading={loading} error={error} onRetry={() => void reload()}
    action={<Button type="button" size="sm" variant="ghost" onClick={() => onOpen(null)}>写资料</Button>}
    footer={<><span className={styles.muted}>最近整理 · 与资料页相同日期范围</span><Button type="button" size="sm" variant="ghost" onClick={() => onOpen()}>全部资料</Button></>}>
    {data && <><div className={styles.metric}><strong>{data.todayCount}</strong><span>篇资料归属于今天</span></div>
      {data.recent.length === 0 ? <p className={styles.empty}>还没有资料。记下一个知识点，或今天的新想法。</p>
        : <ul className={styles.rows}>{data.recent.map((entry) => <li key={entry.id}><button type="button" className={styles.row} onClick={() => onOpen(entry)}>
          <span className={styles.rowContent}><span className={styles.rowTitle}>{entry.title || entry.contentText.split('\n')[0] || '无标题资料'}</span>
            <small>{data.tabs.find((tab) => tab.id === entry.tabId)?.name || '未分类'} · {entry.recordDate}</small></span>
          <span className={styles.muted}>打开</span>
        </button></li>)}</ul>}
    </>}
  </OverviewCard>;
}
