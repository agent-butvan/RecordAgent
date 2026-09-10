import { useCallback, useEffect, useRef, useState } from 'react';
import { DotsThree } from '@phosphor-icons/react';
import { fetchActiveStudySession, fetchStudyCategories, fetchStudyStatistics, startStudySession } from '../../../services/studyApi';
import { formatLocalDate } from '../../../services/dailyEvents';
import { notifyStudySessionChanged, subscribeStudySessionChanges } from '../../../services/studySessionEvents';
import { mergeCategoryOptions } from '../../common/categoryOptions';
import { StudyStartModal } from '../../study/StudyStartModal';
import { STUDY_CATEGORIES } from '../../study/studyCategories';
import { useOverviewResource } from './useOverviewResource';
import { overviewDuration } from './overviewData';
import styles from './SessionOverview.module.css';

export interface StudyTileProps {
  date: string;
  onOpenStudy: () => void;
}

const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const compactDuration = (seconds: number) => {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h` : `${minutes}m`;
};
const weekday = (date: string) => new Intl.DateTimeFormat('zh-CN', { weekday: 'short' })
  .format(new Date(`${date}T12:00:00`)).replace('周', '');

export function LearningTile({ date, onOpenStudy }: StudyTileProps) {
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
  const ringProgress = Math.min(100, Math.round(((today?.durationSeconds ?? 0) / maximum) * 100));

  return (
    <>
      <section className={`${styles.tile} ${styles.learning}`}>
        <div className={styles.tileHead}>
          <div>
            <div className={styles.eyebrow}>LEARNING</div>
            <div className={styles.title}>今日学习</div>
          </div>
          <button type="button" className={styles.more} onClick={onOpenStudy} aria-label="打开学习记录" title="打开学习记录">
            <DotsThree size={18} weight="bold" />
          </button>
        </div>

        {loading ? (
          <p className={styles.empty}>正在加载学习数据…</p>
        ) : error ? (
          <p className={styles.error} onClick={() => void reload()}>{error}</p>
        ) : data ? (
          <>
            <div className={styles.learnRing}>
              <div
                className={styles.ring}
                style={{
                  background: `conic-gradient(#2f6df6 0 ${ringProgress}%, #eef2f6 ${ringProgress}% 100%)`,
                }}
              >
                <div className={styles.ringLabel}>{compactDuration(today?.durationSeconds ?? 0)}</div>
              </div>
              <div className={styles.learnKpis}>
                <div><span>近 7 天</span><b>{overviewDuration(weekTotal)}</b></div>
                <div><span>连续学习</span><b>{streak} 天</b></div>
                <div><span>今日片段</span><b>{today?.sessionCount ?? 0} 段</b></div>
                <div><span>本月累计</span><b>{overviewDuration(monthTotal)}</b></div>
              </div>
            </div>

            <div className={styles.weekDots}>
              {weekDays.map((day) => (
                <div className={styles.day} key={day.date} title={`${day.date}：${overviewDuration(day.durationSeconds)}`}>
                  <div className={styles.bar}>
                    <i style={{ height: `${maximum > 0 ? (day.durationSeconds / maximum) * 100 : 0}%` }} />
                  </div>
                  <span>{weekday(day.date)}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <StudyStartModal open={open} saving={saving} error={saveError} categories={mergeCategoryOptions(STUDY_CATEGORIES, data?.categories ?? [])}
        onClose={() => { if (!saving) setOpen(false); }} onStart={(content, category) => changeStudy(() => startStudySession(content, category, TIMEZONE))} />
    </>
  );
}

export function StudyOverviewCard(props: StudyTileProps) {
  return <LearningTile date={props.date} onOpenStudy={props.onOpenStudy} />;
}
