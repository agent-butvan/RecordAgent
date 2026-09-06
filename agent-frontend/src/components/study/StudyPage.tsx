import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpenIcon, ClockCounterClockwiseIcon, PencilSimpleIcon, PlayIcon, TrashIcon } from '@phosphor-icons/react';
import { createManualStudySession, deleteStudySession, fetchActiveStudySession, fetchStudyCategories, fetchStudySessions, fetchStudyStatistics, finishStudySession, startStudySession, updateStudySession } from '../../services/studyApi';
import { formatLocalDate } from '../../services/dailyEvents';
import type { SaveStudySessionInput, StudySession, StudyStatistics } from '../../types/study';
import { Button } from '../common/Button';
import { mergeCategoryOptions } from '../common/categoryOptions';
import { useMessage } from '../common/Message';
import { TopBar } from '../common/TopBar';
import { StudyRecordModal } from './StudyRecordModal';
import { StudyStartModal } from './StudyStartModal';
import { STUDY_CATEGORIES } from './studyCategories';
import styles from './StudyPage.module.css';

const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const MIN_TIMELINE_HOURS = 8;

function shiftedDate(days: number): Date { const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() + days); return date; }
function startOfMonth(): Date { const date = new Date(); date.setDate(1); date.setHours(12, 0, 0, 0); return date; }
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return seconds > 0 ? '不足 1 分钟' : '0 分钟';
  const hours = Math.floor(minutes / 60); const rest = minutes % 60;
  return hours ? `${hours} 小时${rest ? ` ${rest} 分钟` : ''}` : `${minutes} 分钟`;
}
function formatTimer(seconds: number): string { return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map((value) => String(Math.max(0, Math.floor(value))).padStart(2, '0')).join(':'); }
function formatClock(instant: string): string { return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(instant)); }
function weekday(date: string): string { return new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(new Date(`${date}T12:00:00`)).replace('周', ''); }
function createTimelineRange(sessions: StudySession[], now: number, todayKey: string) {
  const dayStart = new Date(`${todayKey}T00:00:00`).getTime();
  const points = sessions.flatMap((session) => [
    new Date(session.startedAt).getTime(),
    session.endedAt ? new Date(session.endedAt).getTime() : now,
  ]);
  const earliestHour = Math.min(...points.map((point) => (point - dayStart) / 3_600_000));
  const latestHour = Math.max(...points.map((point) => (point - dayStart) / 3_600_000));
  let startHour = Math.max(0, Math.floor((earliestHour - 1) / 2) * 2);
  let endHour = Math.min(24, Math.ceil((latestHour + 1) / 2) * 2);

  if (endHour - startHour < MIN_TIMELINE_HOURS) {
    const missingHours = MIN_TIMELINE_HOURS - (endHour - startHour);
    startHour = Math.max(0, startHour - Math.ceil(missingHours / 4) * 2);
    endHour = Math.min(24, Math.max(endHour, startHour + MIN_TIMELINE_HOURS));
    startHour = Math.max(0, endHour - MIN_TIMELINE_HOURS);
  }

  const step = endHour - startHour > 14 ? 4 : 2;
  const ticks = Array.from({ length: Math.floor((endHour - startHour) / step) + 1 }, (_, index) => startHour + index * step);
  if (ticks.at(-1) !== endHour) ticks.push(endHour);
  return { startHour, endHour, ticks };
}

function timelinePosition(session: StudySession, now: number, todayKey: string, startHour: number, endHour: number) {
  const start = new Date(session.startedAt); const end = session.endedAt ? new Date(session.endedAt) : new Date(now);
  const dayStart = new Date(`${todayKey}T00:00:00`);
  const rangeStart = dayStart.getTime() + startHour * 3_600_000;
  const total = (endHour - startHour) * 3_600_000;
  const left = Math.max(0, Math.min(100, (start.getTime() - rangeStart) / total * 100));
  const right = Math.max(0, Math.min(100, (end.getTime() - rangeStart) / total * 100));
  return { left, width: Math.max(0, right - left) };
}

/** 学习记录工作台：将即时打卡、时间轴、历史维护和统计集中在单一页面。 */
export function StudyPage() {
  const { showMessage } = useMessage();
  const [active, setActive] = useState<StudySession | null>(null);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [weekStats, setWeekStats] = useState<StudyStatistics | null>(null);
  const [previousWeekStats, setPreviousWeekStats] = useState<StudyStatistics | null>(null);
  const [monthStats, setMonthStats] = useState<StudyStatistics | null>(null);
  const [rememberedCategories, setRememberedCategories] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now()); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false); const [error, setError] = useState<string | null>(null); const [recordError, setRecordError] = useState<string | null>(null);
  const [startModalOpen, setStartModalOpen] = useState(false); const [startError, setStartError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false); const [editing, setEditing] = useState<StudySession | null>(null); const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null); const today = formatLocalDate(new Date());
    try {
      const [nextActive, recent, nextWeek, previousWeek, nextMonth, categories] = await Promise.all([
        fetchActiveStudySession(), fetchStudySessions(formatLocalDate(shiftedDate(-30)), today, TIMEZONE),
        fetchStudyStatistics(formatLocalDate(shiftedDate(-6)), today, TIMEZONE),
        fetchStudyStatistics(formatLocalDate(shiftedDate(-13)), formatLocalDate(shiftedDate(-7)), TIMEZONE),
        fetchStudyStatistics(formatLocalDate(startOfMonth()), today, TIMEZONE),
        fetchStudyCategories(),
      ]);
      setActive(nextActive); setSessions(recent); setWeekStats(nextWeek); setPreviousWeekStats(previousWeek); setMonthStats(nextMonth); setRememberedCategories(categories);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '学习记录加载失败，请稍后重试。'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { if (!active) return; setNow(Date.now()); const timer = window.setInterval(() => setNow(Date.now()), 1_000); return () => window.clearInterval(timer); }, [active]);

  const elapsed = active ? Math.max(0, Math.floor((now - new Date(active.startedAt).getTime()) / 1_000)) : 0;
  const todayKey = formatLocalDate(new Date()); const todayStat = weekStats?.days.find((day) => day.date === todayKey);
  const todaySeconds = (todayStat?.durationSeconds ?? 0) + (active ? Math.max(0, elapsed - active.durationSeconds) : 0);
  const completedSessions = sessions.filter((session) => session.endedAt !== null);
  const todayStart = new Date(`${todayKey}T00:00:00`).getTime();
  const todayEnd = new Date(`${todayKey}T24:00:00`).getTime();
  const todaySessions = sessions.filter((session) => new Date(session.startedAt).getTime() < todayEnd
    && (!session.endedAt || new Date(session.endedAt).getTime() > todayStart))
    .sort((first, second) => new Date(first.startedAt).getTime() - new Date(second.startedAt).getTime());
  const timelineRange = todaySessions.length ? createTimelineRange(todaySessions, now, todayKey) : null;
  const chartMax = Math.max(1, ...(weekStats?.days.map((day) => day.durationSeconds) ?? [1]));
  const previousTotal = previousWeekStats?.totalDurationSeconds ?? 0;
  const weekChange = previousTotal > 0 ? Math.round(((weekStats?.totalDurationSeconds ?? 0) - previousTotal) / previousTotal * 100) : null;
  const topCategory = useMemo(() => {
    const totals = new Map<string, number>(); completedSessions.forEach((session) => totals.set(session.category, (totals.get(session.category) ?? 0) + session.durationSeconds));
    return [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [completedSessions]);
  const categoryOptions = mergeCategoryOptions(STUDY_CATEGORIES, rememberedCategories);

  const begin = async (content: string, category: string) => {
    setSaving(true); setStartError(null);
    try { await startStudySession(content, category, TIMEZONE); setStartModalOpen(false); await reload(); showMessage('success', '学习已开始'); }
    catch (cause) { setStartError(cause instanceof Error ? cause.message : '开始学习失败'); } finally { setSaving(false); }
  };
  const finish = async () => {
    if (!active) return; setSaving(true);
    try { await finishStudySession(active.id, active.version); await reload(); showMessage('success', '本次学习已记录'); }
    catch (cause) { showMessage('error', cause instanceof Error ? cause.message : '结束学习失败'); } finally { setSaving(false); }
  };
  const openManual = () => { setEditing(null); setRecordError(null); setModalOpen(true); };
  const openEdit = (session: StudySession) => { setEditing(session); setRecordError(null); setModalOpen(true); };
  const saveRecord = async (input: SaveStudySessionInput) => {
    setSaving(true); setRecordError(null);
    try { if (editing) await updateStudySession(editing.id, editing.version, input); else await createManualStudySession(input); setModalOpen(false); setEditing(null); await reload(); showMessage('success', editing ? '学习记录已更新' : '补卡完成'); }
    catch (cause) { setRecordError(cause instanceof Error ? cause.message : '学习记录保存失败'); } finally { setSaving(false); }
  };
  const remove = async (session: StudySession) => {
    if (confirmDeleteId !== session.id) { setConfirmDeleteId(session.id); return; } setSaving(true);
    try { await deleteStudySession(session.id, session.version); setConfirmDeleteId(null); await reload(); showMessage('success', '学习记录已删除'); }
    catch (cause) { showMessage('error', cause instanceof Error ? cause.message : '删除失败'); } finally { setSaving(false); }
  };

  return <main className={styles.workspace}>
    <TopBar title="记录" subtitle="本地数据" icon={<BookOpenIcon size={15} />} actions={<div className={styles.topActions}>
      <button type="button" className={styles.textAction} onClick={openManual}>补卡</button>
      <Button type="button" variant="primary" size="sm" icon={<PlayIcon size={13} weight="fill" />}
        onClick={() => { setStartError(null); setStartModalOpen(true); }} disabled={Boolean(active)}>{active ? '学习中' : '开始学习'}</Button>
    </div>} />
    <div className={styles.page}><div className={styles.content}>
      {error && <div className={styles.dataError} role="alert"><span>{error}</span><button onClick={() => void reload()}>重新加载</button></div>}
      <section className={styles.overview} aria-label="学习概览">
        <div className={styles.todayBlock}><span>今天已学习</span><strong>{formatDuration(todaySeconds)}</strong><small>{todayStat?.sessionCount ?? 0} 段已完成记录</small></div>
        <dl className={styles.periodStats}><div><dt>近 7 天</dt><dd>{formatDuration(weekStats?.totalDurationSeconds ?? 0)}</dd></div><div><dt>本月累计</dt><dd>{formatDuration(monthStats?.totalDurationSeconds ?? 0)}</dd></div><div><dt>学习天数</dt><dd>{monthStats?.studyDays ?? 0} 天</dd></div></dl>
      </section>
      <div className={styles.mainLayout}><div className={styles.primaryColumn}>
        {active && <section className={styles.section}><Heading title="正在学习" subtitle="这段时间会持续计入今天的学习记录" />
          <div className={styles.activeSession}><div className={styles.runningLabel}><i />正在学习</div><strong>{active.content}</strong><div className={styles.timer}>{formatTimer(elapsed)}</div><small>开始于 {formatClock(active.startedAt)}</small><button type="button" onClick={() => void finish()} disabled={saving}>{saving ? '正在结束…' : '结束这段学习'}</button></div>
        </section>}
        <section className={styles.section}><Heading title="今日轨迹" subtitle="每一段专注，都落在它发生的时刻" side={timelineRange ? `${String(timelineRange.startHour).padStart(2, '0')}:00 — ${String(timelineRange.endHour).padStart(2, '0')}:00` : undefined} />
          {timelineRange ? <div className={styles.timeline}>
            <div className={styles.timelineCanvas}>
              <div className={styles.timelineHours} aria-hidden="true"><span />
                <div>{timelineRange.ticks.map((hour, index) => <time key={hour} style={{ left: `${(hour - timelineRange.startHour) / (timelineRange.endHour - timelineRange.startHour) * 100}%` }} className={index === 0 ? styles.firstTick : index === timelineRange.ticks.length - 1 ? styles.lastTick : ''}>{String(hour).padStart(2, '0')}</time>)}</div>
              </div>
              {todaySessions.map((session) => {
                const position = timelinePosition(session, now, todayKey, timelineRange.startHour, timelineRange.endHour);
                const endTime = session.endedAt ? formatClock(session.endedAt) : '现在';
                return <div className={styles.timelineRow} key={session.id}>
                  <div className={styles.timelineLabel}><strong>{session.content}</strong><span>{formatClock(session.startedAt)} — {endTime}</span></div>
                  <div className={styles.timelineTrack} style={{ '--timeline-columns': timelineRange.ticks.length - 1 } as React.CSSProperties}>
                    <i className={session.status === 'active' ? styles.timelineActive : ''} style={{ left: `${position.left}%`, width: `${position.width}%` }} title={`${session.content} · ${formatDuration(session.status === 'active' ? elapsed : session.durationSeconds)}`} aria-label={`${session.content}，${formatClock(session.startedAt)}至${endTime}`}><span>{session.category}</span></i>
                  </div>
                </div>;
              })}
            </div>
          </div> : <div className={styles.compactEmpty}>今天还没有轨迹。开始学习后，时间会在这里留下痕迹。</div>}
        </section>
        <section className={styles.section}><Heading title="最近记录" subtitle="近 30 天完成的学习" side={completedSessions.length > 3 ? <button className={styles.linkButton} type="button" onClick={() => setShowAll((value) => !value)}>{showAll ? '收起' : '查看全部 →'}</button> : undefined} />
          {loading ? <div className={styles.loading}>正在读取学习记录…</div> : completedSessions.length ? <div className={styles.sessionList}>{completedSessions.slice(0, showAll ? completedSessions.length : 3).map((session) => <article className={styles.sessionRow} key={session.id}><time dateTime={session.startedAt}><strong>{String(new Date(session.startedAt).getDate()).padStart(2, '0')}</strong><span>{new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(session.startedAt)).toUpperCase()}</span></time><div className={styles.sessionBody}><div><strong>{session.content}</strong><span>{session.category}</span></div><p>{formatClock(session.startedAt)} — {session.endedAt ? formatClock(session.endedAt) : ''} · {formatDuration(session.durationSeconds)}{session.location ? ` · ${session.location}` : ''}</p></div><div className={styles.rowActions}><button type="button" title="编辑" aria-label={`编辑“${session.content}”`} onClick={() => openEdit(session)}><PencilSimpleIcon size={13} /></button><button type="button" className={confirmDeleteId === session.id ? styles.confirmDelete : ''} title={confirmDeleteId === session.id ? '再次点击确认删除' : '删除'} aria-label={`删除“${session.content}”`} onClick={() => void remove(session)}>{confirmDeleteId === session.id ? '确认' : <TrashIcon size={13} />}</button></div></article>)}</div> : <div className={styles.empty}><ClockCounterClockwiseIcon size={19} /><strong>还没有学习记录</strong><span>开始一次学习，或使用右上角补卡。</span></div>}
        </section>
      </div><aside className={styles.insightColumn}>
        <section className={styles.sideSection}><Heading title="近 7 天节奏" subtitle="每天的有效学习时长" /><div className={styles.chart}>{weekStats?.days.map((day) => <div className={styles.chartDay} key={day.date}><strong>{day.durationSeconds ? Math.round(day.durationSeconds / 60) : '—'}</strong><div className={styles.barArea}><i className={day.date === todayKey ? styles.todayBar : ''} style={{ height: `${Math.max(day.durationSeconds ? 7 : 0, day.durationSeconds / chartMax * 100)}%` }} /></div><span>{weekday(day.date)}</span></div>)}</div><dl className={styles.smallStats}><div><dt>日均时长</dt><dd>{formatDuration(weekStats?.averageDailySeconds ?? 0)}</dd></div><div><dt>学习天数</dt><dd>{weekStats?.studyDays ?? 0} / 7 天</dd></div><div><dt>较上周</dt><dd>{weekChange === null ? '暂无对比' : `${weekChange >= 0 ? '↑' : '↓'} ${Math.abs(weekChange)}%`}</dd></div><div><dt>完成次数</dt><dd>{weekStats?.sessionCount ?? 0} 次</dd></div></dl></section>
        <section className={styles.sideSection}><Heading title="本周观察" /><p className={styles.insight}>这周已经学习 <em>{weekStats?.studyDays ?? 0} 天</em>{weekChange !== null && <>，相比上周{weekChange >= 0 ? '增加' : '减少'}了 <em>{formatDuration(Math.abs((weekStats?.totalDurationSeconds ?? 0) - previousTotal))}</em></>}。{topCategory ? <>最近投入最多的是“<em>{topCategory}</em>”。</> : '完成第一段学习后，这里会生成观察。'}</p></section>
      </aside></div>
    </div></div>
    <StudyStartModal open={startModalOpen} saving={saving} error={startError} categories={categoryOptions}
      onClose={() => { if (!saving) { setStartModalOpen(false); setStartError(null); } }} onStart={begin} />
    <StudyRecordModal open={modalOpen} session={editing} saving={saving} error={recordError} categories={categoryOptions} onClose={() => { if (!saving) { setModalOpen(false); setEditing(null); setRecordError(null); } }} onSave={saveRecord} />
  </main>;
}

function Heading({ title, subtitle, side }: { title: string; subtitle?: string; side?: React.ReactNode }) {
  return <div className={styles.sectionHeading}><div><h2>{title}</h2>{subtitle && <span>{subtitle}</span>}</div>{side && <div className={styles.sectionSide}>{side}</div>}</div>;
}

export default StudyPage;
