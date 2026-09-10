import { useCallback, useEffect, useRef, useState } from 'react';
import { DotsThree } from '@phosphor-icons/react';
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
const compactDuration = (seconds: number) => {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h` : `${minutes}m`;
};
const weekday = (date: string) => new Intl.DateTimeFormat('zh-CN', { weekday: 'short' })
  .format(new Date(`${date}T12:00:00`)).replace('周', '');

/** 学习统计采用后端统一口径，每分钟及跨窗口事件后刷新，避免重复叠加计时。 */
export function StudyOverviewCard({ date, onOpenStudy }: StudyOverviewCardProps) {
  const load = useCallback(async () => {
    const historyFrom = new Date(`${date}T12:00:00`);
    historyFrom.setFullYear(historyFrom.getFullYear() - 1);
    const [active, history, categories] = await Promise.all([
      fetchActiveStudySession(), fetchStudyStatistics(formatLocalDate(historyFrom), date, TIMEZONE), fetchStudyCategories(),
    ]);
    return { active, history, categories };
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
  const historyDays = data?.history.days ?? [];
  const weekDays = historyDays.slice(-7);
  const today = weekDays.find((day) => day.date === date);
  const weekTotal = weekDays.reduce((sum, day) => sum + day.durationSeconds, 0);
  const monthTotal = historyDays.filter((day) => day.date.startsWith(date.slice(0, 7)))
    .reduce((sum, day) => sum + day.durationSeconds, 0);
  let streak = 0;
  for (let index = historyDays.length - 1; index >= 0; index--) {
    if (historyDays[index].durationSeconds <= 0) break;
    streak++;
  }
  const maximum = Math.max(1, ...weekDays.map((day) => day.durationSeconds));
  const ringProgress = Math.min(100, (today?.durationSeconds ?? 0) / maximum * 100);
  return <>
    <OverviewCard className={styles.study} eyebrow="LEARNING" title="今日学习" loading={loading} error={error} onRetry={() => void reload()}
      action={<button type="button" className={styles.moreButton} onClick={onOpenStudy} aria-label="打开学习记录"><DotsThree size={18} weight="bold" aria-hidden="true" /></button>}
      footer={<><span className={styles.muted}>{data?.active ? '计时中 · 每分钟更新' : '准备好就开始'} </span>
        <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => {
          if (data?.active) { const active = data.active; void changeStudy(() => finishStudySession(active.id, active.version)); }
          else { setSaveError(null); setOpen(true); }
        }}>{saving ? '保存中…' : data?.active ? '结束学习' : '开始学习'}</Button></>}>
      {data && <>
        <div className={styles.studyOverview}>
          <div className={styles.studyRing} role="img" aria-label={`今日学习${overviewDuration(today?.durationSeconds ?? 0)}，相当于近七日最高单日的${Math.round(ringProgress)}%`}>
            <svg viewBox="0 0 80 80" aria-hidden="true">
              <circle className={styles.studyRingTrack} cx="40" cy="40" r="32" pathLength="100" />
              <circle className={styles.studyRingValue} cx="40" cy="40" r="32" pathLength="100" strokeDasharray={`${ringProgress} 100`} />
            </svg>
            <strong>{compactDuration(today?.durationSeconds ?? 0)}</strong>
          </div>
          <dl className={styles.studyKpis}>
            <div><dt>近 7 天</dt><dd>{overviewDuration(weekTotal)}</dd></div>
            <div><dt>连续学习</dt><dd>{streak} 天</dd></div>
            <div><dt>今日片段</dt><dd>{today?.sessionCount ?? 0} 段</dd></div>
            <div><dt>本月累计</dt><dd>{overviewDuration(monthTotal)}</dd></div>
          </dl>
        </div>
        {data.active && <p className={styles.activeStudy}><strong>正在学习</strong>{data.active.content}</p>}
        {!open && saveError && <p className={styles.error} role="alert">{saveError}</p>}
        <div className={styles.bars} aria-label="近七天学习时长">{weekDays.map((day) => <div className={styles.barDay} key={day.date} title={`${day.date}：${overviewDuration(day.durationSeconds)}`}>
          <span className={styles.barTrack} role="img" aria-label={`${day.date}学习${overviewDuration(day.durationSeconds)}`}><span className={styles.barFill} style={{ height: `${day.durationSeconds / maximum * 100}%` }} /></span>
          <span>{weekday(day.date)}</span>
        </div>)}</div>
      </>}
    </OverviewCard>
    <StudyStartModal open={open} saving={saving} error={saveError} categories={mergeCategoryOptions(STUDY_CATEGORIES, data?.categories ?? [])}
      onClose={() => { if (!saving) setOpen(false); }} onStart={(content, category) => changeStudy(() => startStudySession(content, category, TIMEZONE))} />
  </>;
}
