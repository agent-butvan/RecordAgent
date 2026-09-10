import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchActiveStudySession, fetchStudyCategories, fetchStudyStatistics, finishStudySession, startStudySession } from '../../../services/studyApi';
import { formatLocalDate } from '../../../services/dailyEvents';
import { notifyStudySessionChanged, subscribeStudySessionChanges } from '../../../services/studySessionEvents';
import { OverviewCard } from '../../common/OverviewCard';
import { Button } from '../../common/Button';
import { mergeCategoryOptions } from '../../common/categoryOptions';
import { StudyStartModal } from '../../study/StudyStartModal';
import { STUDY_CATEGORIES } from '../../study/studyCategories';
import { useOverviewResource } from './useOverviewResource';
import { overviewDuration } from './overviewData';
import styles from './SessionOverview.module.css';

interface StudyOverviewCardProps { date: string; onOpenStudy: () => void }
const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** 学习统计采用后端统一口径，每分钟及跨窗口事件后刷新，避免重复叠加计时。 */
export function StudyOverviewCard({ date, onOpenStudy }: StudyOverviewCardProps) {
  const load = useCallback(async () => {
    const from = new Date(`${date}T12:00:00`);
    from.setDate(from.getDate() - 6);
    const [active, week, categories] = await Promise.all([
      fetchActiveStudySession(), fetchStudyStatistics(formatLocalDate(from), date, TIMEZONE), fetchStudyCategories(),
    ]);
    return { active, week, categories };
  }, [date]);
  const { data, loading, error, reload } = useOverviewResource(load);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const hasActiveStudy = Boolean(data?.active);
  useEffect(() => subscribeStudySessionChanges(() => void reload()), [reload]);
  useEffect(() => {
    if (!hasActiveStudy) return;
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void reload(); }, 60_000);
    return () => window.clearInterval(timer);
  }, [hasActiveStudy, reload]);
  const changeStudy = async (action: () => Promise<unknown>) => {
    if (busy.current) return;
    busy.current = true; setSaving(true); setSaveError(null);
    try {
      await action(); setOpen(false); notifyStudySessionChanged(); await reload();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : '学习状态更新失败，请重试。');
      await reload();
    } finally { busy.current = false; setSaving(false); }
  };
  const today = data?.week.days.find((day) => day.date === date);
  const maximum = Math.max(1, ...(data?.week.days.map((day) => day.durationSeconds) ?? []));
  return <>
    <OverviewCard className={styles.study} title="今日学习" description="给专注留一点时间" loading={loading} error={error} onRetry={() => void reload()}
      action={<Button type="button" size="sm" variant="ghost" onClick={onOpenStudy}>学习记录</Button>}
      footer={<><span className={styles.muted}>{data?.active ? '计时中 · 每分钟更新' : '准备好就开始'} </span>
        <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => {
          if (data?.active) { const active = data.active; void changeStudy(() => finishStudySession(active.id, active.version)); }
          else { setSaveError(null); setOpen(true); }
        }}>{saving ? '保存中…' : data?.active ? '结束学习' : '开始学习'}</Button></>}>
      {data && <><div className={styles.metric}><strong>{overviewDuration(today?.durationSeconds ?? 0)}</strong><span>今日学习</span></div>
        {data.active && <p className={styles.activeStudy}><strong>正在学习</strong>{data.active.content}</p>}
        {!open && saveError && <p className={styles.error} role="alert">{saveError}</p>}
        <dl className={styles.stats}><div><dt>近 7 天</dt><dd>{overviewDuration(data.week.totalDurationSeconds)}</dd></div><div><dt>学习天数</dt><dd>{data.week.studyDays} 天 / 7 天</dd></div><div><dt>今日片段</dt><dd>{today?.sessionCount ?? 0} 段</dd></div></dl>
        <div className={styles.bars} aria-label="近七天学习时长">{data.week.days.map((day) => <div className={styles.barDay} key={day.date} title={`${day.date}：${overviewDuration(day.durationSeconds)}`}>
          <span className={styles.barTrack} role="img" aria-label={`${day.date}学习${overviewDuration(day.durationSeconds)}`}><span className={styles.barFill} style={{ height: `${day.durationSeconds / maximum * 100}%` }} /></span>
          <span>{day.date === date ? '今天' : `${Number(day.date.slice(5, 7))}/${Number(day.date.slice(8))}`}</span>
        </div>)}</div>
      </>}
    </OverviewCard>
    <StudyStartModal open={open} saving={saving} error={saveError} categories={mergeCategoryOptions(STUDY_CATEGORIES, data?.categories ?? [])}
      onClose={() => { if (!saving) setOpen(false); }} onStart={(content, category) => changeStudy(() => startStudySession(content, category, TIMEZONE))} />
  </>;
}
